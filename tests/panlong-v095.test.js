import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../chapters/index.js';
import {validateChapter,paragraphText} from '../reader-core.js';
import {prepareVersionedBackup} from '../backup-versions.js';

const root=new URL('../',import.meta.url);
const data=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));
const corpus=data('reader/panlong/hsk5-final/manuscript.json');
const baseline=new Set(data('reader/panlong/hsk5-final/baseline.json'));
const terms=new Set(data('reader/panlong/hsk5-final/terms.json'));
const notes=data('reader/panlong/hsk5-final/grammar-notes.json');
const spans=data('reader/panlong/hsk5-final/spans.json');
const asset=async(n,edition)=>(await import(`../chapters/graded-${edition}/${n}.js`)).default;

test('v0.9.5 ships both frozen HSK5 and polished HSK6 graded editions aligned to unchanged originals',async()=>{
 let paragraphs=0,unknown=0,ordinary=0,grammarNotes=0,termSeen=new Set();const oov=new Set();
 assert.equal(catalog.filter(x=>x.novel==='panlong').length,23);
 for(let n=1;n<=23;n++){
  const entry=catalog.find(e=>e.novel==='panlong'&&e.number===n);
  assert.equal(entry.gradedFile,`graded-v094/${n}.js`);
  assert.equal(entry.gradedHsk5File,`graded-v095-hsk5/${n}.js`);
  const raw=fs.readFileSync(new URL(`reader/panlong/chapters/${String(n).padStart(3,'0')}.json`,root));
  const digest=createHash('sha256').update(raw).digest('hex');assert.equal(entry.digest,digest);
  const original=JSON.parse(raw),hsk5=await asset(n,'v095-hsk5'),hsk6=await asset(n,'v094');
  assert.equal(hsk5.sourceDigest,digest);assert.equal(hsk6.sourceDigest,digest);
  assert.equal(hsk5.gradeTarget,'hsk5');
  assert.equal(hsk5.editionVersion,hsk6.editionVersion);
  validateChapter({...original,...hsk5});validateChapter({...original,...hsk6});
  assert.deepEqual(hsk5.focus,hsk6.focus);
  assert.deepEqual(hsk5.lexicon.terms,hsk6.lexicon.terms);
  assert.deepEqual(hsk5.lexicon.grammar,hsk6.lexicon.grammar);
  assert.deepEqual(hsk5.nestedTerms,hsk6.nestedTerms);
  grammarNotes+=Object.keys(hsk5.grammarCards).filter(k=>k.startsWith('grammar-pass45-')).length;
  for(let i=0;i<original.paragraphs.length;i++){
   const row=hsk5.paragraphs[i];paragraphs++;
   assert.equal(row.id,original.paragraphs[i].id);
   assert.equal(paragraphText(hsk5,row),corpus[n-1].graded[i],`HSK5 manuscript changed at ${n}:${i+1}`);
   assert.equal(row.anchors.length,row.tokens.length);
   for(const token of row.tokens){
    if(!Array.isArray(token))continue;
    const card=hsk5.items[token[0]];
    if(card.kind==='term'){termSeen.add(card.hanzi);assert.ok(terms.has(card.hanzi));}
    else if(card.kind==='vocab'){ordinary++;if(!baseline.has(card.hanzi)){unknown++;oov.add(card.hanzi);}}
   }
  }
  for(const note of notes.filter(x=>x.chapter===n)){
   const id=Object.keys(hsk5.grammarCards).find(k=>hsk5.grammarCards[k].pattern===`盘龙 ${n}.${note.paragraph} · ${note.pattern}`);
   assert.ok(id,`missing grammar note ${n}:${note.paragraph}`);
   assert.equal(hsk5.grammarCards[id].explanation,note.note);
   assert.equal(hsk5.grammarCards[id].english,note.english);
   assert.ok(paragraphText(hsk5,hsk5.paragraphs[note.paragraph-1]).includes(note.example));
  }
  // Ensure generated tokens reproduce the final audited source spans in full.
  assert.equal(hsk5.paragraphs.length,spans[String(n)].length);
 }
 assert.equal(paragraphs,1648);
 assert.equal(grammarNotes,40);
 // Three short registered terms occur only inside their longer named forms.
 for(const term of ['哈泽德','瑞恩','静态张力'])assert.ok(terms.has(term));
 assert.deepEqual(new Set([...termSeen,'哈泽德','瑞恩','静态张力']),terms);
 assert.equal(ordinary,30227);
 assert.equal(unknown,3728);
 assert.equal(oov.size,952);
 assert.deepEqual(new Set((await asset(1,'v095-hsk5')).extras),oov);
});

test('v0.9.5 identity migration preserves existing reader preferences, bookmarks and study records',()=>{
 const sample={appVersion:'0.9.4',reader:{panlong:{chapters:[{editionPrefs:{graded:true,auto:true,minimum:.94},position:{id:'p1',offset:10}}],history:[{key:'term-林雷',grade:4}]}}};
 const result=prepareVersionedBackup(sample);
 assert.equal(result.appVersion,'0.9.5');
 assert.deepEqual(result.reader,sample.reader);
 assert.equal(sample.appVersion,'0.9.4');
});
