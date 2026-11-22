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

test('v0.9.4 overlay applies 71 reviewed HSK6 prose fixes only; originals and term counts remain unchanged',async()=>{
 assert.equal(edits.edits.length,71);
 const before=[],after=[];let modified=0;
 const allExtras=new Set();
 for(let n=1;n<=23;n++){
  const bytes=readFileSync(new URL(`reader/panlong/chapters/${String(n).padStart(3,'0')}.json`,root));
  const src=JSON.parse(bytes),old=await moduleAsset(n,'graded-v092'),next=await moduleAsset(n,'graded-v094');
  const entry=catalog.find(e=>e.novel==='panlong'&&e.number===n);
  assert.equal(entry.gradedFile,`graded-v094/${n}.js`);
  assert.equal(entry.digest,digest(bytes));
  assert.equal(next.sourceDigest,entry.digest);
  assert.equal(old.sourceDigest,next.sourceDigest);
  assert.equal(next.editionVersion,46);
  assert.deepEqual(next.focus,old.focus);
  assert.deepEqual(next.lexicon.terms,old.lexicon.terms);
  assert.deepEqual(next.lexicon.grammar,old.lexicon.grammar);
  assert.deepEqual(next.grammarCards,old.grammarCards);
  assert.deepEqual(next.nestedTerms,old.nestedTerms);
  validateChapter({...src,...next});
  assert.equal(chapterText(src).split('\n\n').length,src.paragraphs.length+1);
  for(let i=0;i<src.paragraphs.length;i++){
   const prior=paragraphText(old,old.paragraphs[i]),actual=paragraphText(next,next.paragraphs[i]);
   let expected=prior;
   for(const e of changedByChapter.get(n)?.get(i+1)||[]){
    assert.equal(expected.split(e.before).length,2,`ambiguous ${n}:${i+1}`);
    expected=expected.replace(e.before,e.after);
   }
   assert.equal(actual,expected,`Unexpected change in chapter ${n} paragraph ${i+1}`);
   if(prior!==actual)modified++;
   before.push(prior);after.push(actual);
  }
  for(const k of next.lexicon.vocabulary){const w=next.items[k].hanzi;if(!baseline.has(w))allExtras.add(w);}
  if(next.items['vocab-说道']){
   assert.equal(next.items['vocab-说道'].english,edits.glossaryCorrection['说道'].english);
  }
 }
 assert.equal(modified,70);
 for(const term of lexicon.keys()){
  const occur=texts=>texts.reduce((sum,t)=>sum+t.split(term).length-1,0);
  assert.equal(occur(before),occur(after),`Protected literal term occurrence changed: ${term}`);
 }
 const finalAsset=await moduleAsset(23,'graded-v094');
 assert.deepEqual(new Set(finalAsset.extras),allExtras);
 assert.equal(finalAsset.extras.length,632);
});
