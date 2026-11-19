// Deterministic reconstruction of Panlong Volume 1 chapters 4–11 from the
// user-supplied, source-verified UTF-8 text. Never normalize or rewrite prose.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {MASTER} from '../master-data.js';
import {chapterText,validateChapter} from '../reader-core.js';
const directory=fileURLToPath(new URL('../reader/panlong/',import.meta.url));
const read=name=>fs.readFileSync(directory+name,'utf8');
const dictionary=new Map(MASTER.cards.map(({hanzi,pinyin,english})=>[hanzi,{kind:'vocab',hanzi,pinyin,english}]));
const specialWords=new Set();
const knownKinds=new Map();
for(let i=1;i<=3;i++)for(const c of Object.values(JSON.parse(read(`chapters/${String(i).padStart(3,'0')}.json`)).items))
 if(c.kind!=='grammar')knownKinds.set(c.hanzi,c.kind);
for(const [filename,kind,force] of [['lexicon.tsv','term',true],['vocabulary.tsv','vocab',true],['characters.tsv','vocab',false],['extended-lexicon.tsv','vocab',true],['extra-characters.tsv','vocab',false]]){
 if(!fs.existsSync(directory+filename))continue;
 for(const line of read(filename).trim().split('\n').filter(Boolean)){
  const [hanzi,pinyin,english]=line.split('\t');
  if(!hanzi||!pinyin||!english)throw Error(`Incomplete ${filename} glossary entry: ${line}`);
  const named=new Set(['迅猛龙','七级魔兽','嗜血铁牛','铁牛','狮鹰','火蛇之舞','火蛇','佣兵小队','冰之守护战甲','斗气护罩','魔兽','巴鲁克家族','腓力','路加','路易莎','凯莱','火系魔法师','魔法师','盘龙戒指','黑色戒指','玉兰大陆','芬莱王国','乌山镇','林雷','希尔曼','罗瑞','罗杰','霍格','龙血战士','魔兽山脉']);
  const proposed=filename==='extended-lexicon.tsv'&&named.has(hanzi)?'term':kind;
  const existing=dictionary.get(hanzi),record={kind:knownKinds.get(hanzi)||proposed,hanzi,pinyin,english};
  if(filename==='extra-characters.tsv'&&existing)continue;
  if(filename==='extended-lexicon.tsv'&&existing&&filename.includes('extended'))record.kind=knownKinds.get(hanzi)||existing.kind;
  dictionary.set(hanzi,record);
  if(force)specialWords.add(hanzi);
 }
}
const aliases=JSON.parse(read('aliases.json'));
for(const [alias,name] of Object.entries(aliases))if(dictionary.has(name)){dictionary.set(alias,dictionary.get(name));specialWords.add(alias);}
const wordRegex=new RegExp('('+[...specialWords].sort((a,b)=>b.length-a.length).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gu');
const segmenter=new Intl.Segmenter('zh-Hans',{granularity:'word'});
const missing=new Set();
const tokenizeChinese=text=>{
 if(dictionary.has(text))return [text];
 // Prefer known multi-character entries, rather than teaching meaningless
 // individual characters when a recognizable expression is available.
 const dp=Array(text.length+1).fill(null);dp[text.length]={cost:0,words:[]};
 for(let i=text.length-1;i>=0;i--){
  for(let j=i+1;j<=Math.min(text.length,i+8);j++){
   const part=text.slice(i,j),item=dictionary.get(part);
   if(!item&&j!==i+1)continue;
   if(!dp[j])continue;
   const unknown=item?0:200;
   const cost=dp[j].cost+unknown+1/(part.length*part.length);
   if(!dp[i]||cost<dp[i].cost)dp[i]={cost,words:[part,...dp[j].words]};
  }
 }
 return dp[0]?.words??[...text];
};
const tokensFor=text=>{
 const tokens=[];
 for(const piece of text.split(wordRegex).filter(Boolean)){
  const words=dictionary.has(piece)?[piece]:Array.from(segmenter.segment(piece),x=>x.segment);
  for(const word of words){
   for(const part of word.match(/\p{Script=Han}+|[^\p{Script=Han}]+/gu)||[]){
    if(!/\p{Script=Han}/u.test(part)){tokens.push(part);continue;}
    for(const chunk of tokenizeChinese(part)){
     const item=dictionary.get(chunk);
     if(!item){missing.add(chunk);continue;}
     tokens.push(chunk===item.hanzi?[`${item.kind}-${item.hanzi}`]:[`${item.kind}-${item.hanzi}`,chunk]);
    }
   }
  }
 }
 return tokens;
};
const specs=JSON.parse(read('study-extended.json'));
for(let i=4;i<=11;i++){
 const stem=String(i).padStart(3,'0');
 const raw=read('new-raw/'+stem+'.txt').replace(/\r\n/g,'\n');
 const [heading,...body]=raw.trimEnd().split('\n\n');
 const parts=heading.split('\n');
 if(parts.length!==3||parts[0]!=='盘龙'||parts[1]!=='第一集 盘龙之戒')throw Error(`Unexpected chapter ${stem} source header`);
 const title=parts[2].replace(/^第[一二三四五六七八九十]+章\s*/u,x=>x); // keep exact supplied title
 const reference=[title,...body].join('\n\n');
 const paragraphs=body.map((line,index)=>({id:'p'+(index+1),tokens:tokensFor(line)}));
 const used=new Set(paragraphs.flatMap(p=>p.tokens).filter(t=>Array.isArray(t)).map(t=>t[0]));
 const items={};for(const id of used){const name=id.slice(id.indexOf('-')+1);const item=dictionary.get(name);if(!item)throw Error('Missing '+id);items[id]=item;}
 const authored=[];for(const word of specs[i]||[]){
  const item=dictionary.get(word);if(!item)throw Error(`Missing study word for chapter ${i}: ${word}`);
  const id=`${item.kind}-${item.hanzi}`;
  if(!used.has(id)){console.warn(`Not used in chapter ${i}: ${word}`);continue;}
  if(!authored.includes(id))authored.push(id);
 }
 if(authored.length<7)throw Error(`Too few authored study words for chapter ${i}`);
 const data={format:'ciyan-chapter',version:1,novel:'panlong',book:'盘龙',number:i,title,revision:1,author:'我吃西红柿',volume:1,volumeTitle:'盘龙之戒',paragraphs,items,authored};
 if(!missing.size){validateChapter(data);if(chapterText(data)!==reference)throw Error(`Text mismatch in chapter ${i}`);
  fs.mkdirSync(directory+'reference/',{recursive:true});fs.writeFileSync(directory+'reference/'+stem+'.txt',reference);
  fs.writeFileSync(directory+'chapters/'+stem+'.json',JSON.stringify(data));
  console.log(stem,paragraphs.length,'paragraphs',Object.keys(items).length,'items',authored.length,'study words');
 }
}
if(missing.size){console.error('Missing characters/words:',[...missing].join(' '));process.exitCode=1;}
