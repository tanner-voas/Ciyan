// Integrate the final reviewed version. Use the audited token spans as the source
// of truth, rather than greedily tokenizing them again and undoing corrections.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MASTER} from '../master-data.js';
import {validateChapter,chapterText,paragraphText} from '../reader-core.js';
import oldLexicon from '../chapters/panlong-lexicon.js';
const root=new URL('../reader/panlong/',import.meta.url), assets=new URL('../chapters/',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const write=(p,x)=>fs.writeFileSync(new URL(p,root),JSON.stringify(x)+'\n');
const digest=x=>createHash('sha256').update(x).digest('hex');
const stem=n=>String(n).padStart(3,'0');
const oldCorpus=read('pass45/corpus.json'), corpus=read('pass46/corpus.json'),spans=read('pass46/spans.json'),reg=read('pass45/register.json');
const notes=read('pass46/notes.json'), oldNotes=read('pass45/notes.json');
const baseline=new Set(MASTER.cards.filter(c=>c.tags.some(t=>/^HSK\/HSK[1-6]$|^TSK\/TSK(0[1-9]|1[0-2])$/.test(t))).map(c=>c.hanzi));
assert.equal(baseline.size,6553);assert.deepEqual(baseline,new Set(read('pass46/baseline.json')));
const terms=new Set(reg.terms.map(r=>r.term));const dictionary=new Map();
const put=(w,pinyin,english)=>{if(w&&pinyin&&english)dictionary.set(w,{kind:'vocab',hanzi:w,pinyin:pinyin.slice(0,160),english:english.slice(0,500)});};
for(const [surface,[id,kind,w,p,e]] of oldLexicon)if(surface===w)put(w,p,e);
for(const r of read('pass45/fallback.json'))put(r.hanzi,r.pinyin,r.english);
const originalSources=[],oldAssets=[];
for(const c of corpus){
 const p=read('chapters/'+stem(c.number)+'.json'),{default:a}=await import('../chapters/graded-v091/'+c.number+'.js');
 // Restore metadata only for the historical digest check. The original prose
 // and original token items are never modified by this compiler.
 const historical={...p,revision:45,editionVersion:45,boundaries:'pass45-original'};
 assert.equal(digest(JSON.stringify(historical)+'\n'),a.sourceDigest,'Unexpected change to original '+c.number);
 originalSources.push(historical);oldAssets.push(a);
 for(const o of [a,p])for(const r of Object.values(o.items))if(r.kind!=='grammar')put(r.hanzi,r.pinyin,r.english);
}
for(const r of MASTER.cards)put(r.hanzi,r.pinyin,r.english);
for(const r of reg.ordinary)put(r.word,r.pinyin,r.english);
for(const r of read('pass46/new-glosses.json'))put(r.hanzi,r.pinyin,r.english);
for(const r of reg.terms)dictionary.set(r.term,{kind:'term',hanzi:r.term,pinyin:r.pinyin,english:r.english});
const surface=(t,items)=>typeof t==='string'?t:t[1]??items[t[0]].hanzi;
function itemFor(w){const r=dictionary.get(w);assert.ok(r,'Missing definition: '+w);return r;}
function emit(items,t){if(!t.annotated){assert.ok(!/\p{Script=Han}/u.test(t.text),'Unannotated Han text');return t.text;}
 const w=t.text,r=itemFor(w),id=r.kind+'-'+w;items[id]=r;return [id];}
fs.mkdirSync(new URL('graded-v092/',assets),{recursive:true});
const volumeExtras=[...new Set(Object.values(spans).flat(2).filter(t=>t.annotated&&!baseline.has(t.text)&&!terms.has(t.text)).map(t=>t.text))].sort();
const seenTerms=new Set(),seenVocab=new Set(),stats=[];
for(const c of corpus){
 const n=c.number,locked=oldCorpus[n-1],prev=oldAssets[n-1],old=originalSources[n-1];
 for(const k of ['number','title','original','archival'])assert.deepEqual(c[k],locked[k]);
 assert.equal(c.graded.length,locked.graded.length);
 const original={...old,revision:46,editionVersion:46,boundaries:'pass46-original'};
 validateChapter(original);
 assert.equal(chapterText(original),[c.title,...c.original].join('\n\n'));
 const originalBytes=JSON.stringify(original)+'\n',sourceDigest=digest(originalBytes);
 const items=Object.fromEntries(Object.entries(prev.items).filter(([k,r])=>r.kind==='grammar')),grammarCards=structuredClone(prev.grammarCards);
 const paragraphs=spans[n].map((row,i)=>{
  assert.equal(row.map(x=>x.text).join(''),c.graded[i]);assert.equal(c.anchors[i].length,c.graded[i].length);
  let pos=0;
  const tokens=row.map(t=>emit(items,t)),anchors=row.map(t=>{const a=c.anchors[i][pos];pos+=t.text.length;return a;});
  assert.ok(anchors.every((a,j)=>Number.isInteger(a)&&a>=0&&a<c.original[i].length&&(!j||a>=anchors[j-1])));
  return {id:old.paragraphs[i].id,tokens,anchors};
 });
 // Retain all existing grammar IDs. The one changed targeted example is
 // recompiled from the exact revised excerpt, with the existing note identity.
 for(const [i,note] of notes.entries())if(note.chapter===n){
  const j=note.paragraph-1,text=c.graded[j],id='grammar-pass45-'+(i+1),at=text.indexOf(note.example);
  assert.ok(at>=0);assert.ok(items[id]&&grammarCards[id]);
  if(note.example!==oldNotes[i].example){
   const selected=[];let off=0;
   for(const t of spans[n][j]){const end=off+t.text.length;if(off>=at&&end<=at+note.example.length)selected.push(t);off=end;}
   assert.equal(selected.map(t=>t.text).join(''),note.example,'Grammar excerpt needs boundary review');
   const markup=selected.map(t=>t.annotated?'{'+t.text+'}':t.text).join('');
   const pinyin=selected.map(t=>t.annotated?itemFor(t.text).pinyin:t.text).join(' ');
   grammarCards[id]={...grammarCards[id],markup,pinyin,english:note.english,explanation:note.note};
   items[id]={...items[id],pinyin:pinyin.slice(0,160),english:note.english+' — '+note.note};
  }
  assert.equal(grammarCards[id].markup.replace(/[{}]/g,''),note.example);
 }
 const nestedTerms=[];
 for(const w of terms){const id='term-'+w;if(!items[id]&&c.graded.some(t=>t.includes(w))){items[id]=itemFor(w);nestedTerms.push(id);}}
 const lexicon={vocabulary:[],terms:[],grammar:[]};
 for(const [id,r] of Object.entries(items))lexicon[r.kind==='vocab'?'vocabulary':r.kind==='term'?'terms':'grammar'].push(id);
 // Preserve each chapter's complete term study set, not just its independent spans.
 assert.deepEqual(new Set(lexicon.terms),new Set(prev.lexicon.terms),'Term register drift in chapter '+n);
 const extras=[...new Set(lexicon.vocabulary.map(id=>items[id].hanzi).filter(w=>!baseline.has(w)))];
 const a={sourceDigest,items,paragraphs,focus:[...lexicon.terms,...lexicon.grammar],lexicon,grammarCards,nestedTerms,extras:volumeExtras,fallbackVocabulary:[],editionVersion:46};
 validateChapter({...original,...a});assert.equal(chapterText({...original,...a}),[c.title,...c.graded].join('\n\n'));
 for(const id of lexicon.terms)seenTerms.add(items[id].hanzi);
 for(const w of extras)seenVocab.add(w);
 fs.writeFileSync(new URL('chapters/'+stem(n)+'.json',root),originalBytes);
 fs.writeFileSync(new URL('graded-v092/'+n+'.js',assets),'export default '+JSON.stringify(a)+';\n');
 stats.push({chapter:n,paragraphs:paragraphs.length,rawOov:extras.length,terms:lexicon.terms.length,independentTerms:lexicon.terms.length-nestedTerms.length,grammar:lexicon.grammar.length});
}
assert.equal(seenTerms.size,198);assert.equal(seenVocab.size,read('pass46/audit-summary.json').reconciled_raw);
write('pass46/build-report.json',{baseline:baseline.size,rawOov:seenVocab.size,terms:seenTerms.size,stats,ordinary:[...seenVocab].sort(),registeredTerms:[...seenTerms].sort()});
console.log('Built',stats.length,'graded editions;',stats.reduce((s,x)=>s+x.paragraphs,0),'paragraphs;',seenVocab.size,'distinct OOV vocabulary;',seenTerms.size,'distinct terms.');
