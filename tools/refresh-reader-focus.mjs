// Rebuild chapter-specific focus metadata without rewriting any Chinese prose.
// Idempotent: already-refreshed chapters retain their revision and digest.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chapterText,validateChapter} from '../reader-core.js';
const root=fileURLToPath(new URL('../reader/',import.meta.url));
const spec=JSON.parse(fs.readFileSync(root+'focus-grammar.json','utf8'));
const directoryEntries=[...Array.from({length:11},(_,i)=>`panlong/chapters/${String(i+1).padStart(3,'0')}.json`),
 ...['two-cups','which-exit','takeaway'].map(n=>`samples/${n}.json`)];
for(const filename of directoryEntries){
 const file=root+filename;
 const prior=fs.readFileSync(file,'utf8'),chapter=JSON.parse(prior);
 const originalText=chapterText(chapter),items={};
 const remap=new Map();
 for(const [id,entry] of Object.entries(chapter.items)){
  if(entry.kind==='vocab'&&chapter.novel==='panlong'&&Object.hasOwn(spec.termOverrides,entry.hanzi)){
   const newId='term-'+entry.hanzi;
   const next={...entry,kind:'term',english:spec.termOverrides[entry.hanzi]};
   if(Object.hasOwn(items,newId)&&JSON.stringify(items[newId])!==JSON.stringify(next))throw Error(`Conflicting term ${newId}`);
   items[newId]=next;remap.set(id,newId);
  }else items[id]=entry;
 }
 for(const row of chapter.paragraphs)for(const token of row.tokens){
  if(Array.isArray(token)&&remap.has(token[0]))token[0]=remap.get(token[0]);
 }
 chapter.items=items;
 const patternNames=spec.chapters[chapter.novel]?.[String(chapter.number)]||[];
 for(const name of patternNames){
  const id='grammar-'+name;
  if(!chapter.items[id])chapter.items[id]={kind:'grammar',...spec.grammar[name]};
 }
 const used=new Set(chapter.paragraphs.flatMap(p=>p.tokens.filter(Array.isArray).map(t=>t[0])));
 // The focus includes every named term actually present, plus critical grammar.
 chapter.focus=[...new Set([...Object.entries(chapter.items)
  .filter(([id,item])=>item.kind==='term'&&used.has(id)).map(([id])=>id),
  ...Object.entries(chapter.items).filter(([id,item])=>item.kind==='grammar').map(([id])=>id)])];
 delete chapter.authored;
 // Compare first, then advance revision only for a semantic change.
 const withoutRevision={...chapter};delete withoutRevision.revision;
 const old=JSON.parse(prior);delete old.revision;
 if(JSON.stringify(withoutRevision)!==JSON.stringify(old)){
  chapter.revision+=1;
  validateChapter(chapter);
  if(chapterText(chapter)!==originalText)throw Error(`Reading text changed: ${filename}`);
  fs.writeFileSync(file,JSON.stringify(chapter));
  console.log(filename,'revision',chapter.revision,'focus',chapter.focus.length,'terms',chapter.focus.filter(k=>k.startsWith('term-')).length,'grammar',chapter.focus.filter(k=>k.startsWith('grammar-')).length);
 }else console.log(filename,'unchanged');
}
