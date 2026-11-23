import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateChapter,paragraphText,chapterText} from '../reader-core.js';
import catalog from '../chapters/index.js';

const root=new URL('../',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const edits=read('reader/panlong/v094-edits.json');
const register=read('reader/panlong/pass45/register.json');
const baseline=new Set(read('reader/panlong/pass46/baseline.json'));
const lexicon=new Map(register.terms.map(t=>[t.term,t]));
const digest=b=>createHash('sha256').update(b).digest('hex');
const changedByChapter=new Map();
for(const e of edits.edits){if(!changedByChapter.has(e.chapter))changedByChapter.set(e.chapter,new Map());
 const c=changedByChapter.get(e.chapter);if(!c.has(e.paragraph))c.set(e.paragraph,[]);c.get(e.paragraph).push(e);
}

async function moduleAsset(n,folder){return (await import(`../chapters/${folder}/${n}.js`)).default;}

test('v0.9.9 retains the historic HSK6 overlay manifest while shipping the aligned final edition',async()=>{
 assert.equal(edits.edits.length,71);
 const frozen=read('reader/panlong/v099/hsk6/manuscript.json');
 const protectedTerms=new Set(read('reader/panlong/hsk5-final/terms.json'));
 assert.equal(frozen.length,23);
 let paragraphs=0;const all=new Set();
 for(let n=1;n<=23;n++){
  const bytes=readFileSync(new URL(`reader/panlong/chapters/${String(n).padStart(3,'0')}.json`,root));
  const original=JSON.parse(bytes),current=await moduleAsset(n,'graded-v094');
  const entry=catalog.find(c=>c.novel==='panlong'&&c.number===n);
  assert.equal(current.sourceDigest,digest(bytes));assert.equal(entry.digest,digest(bytes));
  assert.equal(current.gradeTarget,'hsk6');
  assert.deepEqual(current.paragraphs.map(r=>r.id),original.paragraphs.map(r=>r.id));
  validateChapter({...original,...current});
  for(let i=0;i<current.paragraphs.length;i++){
   paragraphs++;assert.equal(paragraphText(current,current.paragraphs[i]),frozen[n-1].graded[i]);
   assert.equal(paragraphText(original,original.paragraphs[i]),frozen[n-1].original[i]);
  }
  for(const k of current.lexicon.terms)all.add(current.items[k].hanzi);
  assert.ok(current.lexicon.terms.every(k=>protectedTerms.has(current.items[k].hanzi)));
 }
 assert.equal(paragraphs,1648);assert.equal(all.size,198);
});
