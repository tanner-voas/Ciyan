import {APP_VERSION} from '../backup-versions.js';
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

test('v0.9.9 includes all three audited graded levels, aligned to 23 source chapters',async()=>{
 const grades=[['hsk4','v099-hsk4','gradedHsk4File'],['hsk5','v095-hsk5','gradedHsk5File'],['hsk6','v094','gradedFile']];
 for(const [grade,folder,fileKey] of grades){
  const corpus=data(`reader/panlong/v099/${grade}/manuscript.json`);
  const notes=data(`reader/panlong/v099/${grade}/grammar-notes.json`);
  const spans=data(`reader/panlong/v099/${grade}/spans.json`);
  assert.equal(notes.length,40);assert.equal(corpus.length,23);
  let paragraphs=0,grammarNotes=0;
  for(let n=1;n<=23;n++){
   const entry=catalog.find(e=>e.novel==='panlong'&&e.number===n);
   assert.equal(entry[fileKey],`graded-${folder}/${n}.js`);
   const raw=fs.readFileSync(new URL(`reader/panlong/chapters/${String(n).padStart(3,'0')}.json`,root));
   const original=JSON.parse(raw),overlay=await asset(n,folder),digest=createHash('sha256').update(raw).digest('hex');
   assert.equal(entry.digest,digest);assert.equal(overlay.sourceDigest,digest);
   assert.equal(overlay.gradeTarget,grade);validateChapter({...original,...overlay});
   for(let i=0;i<original.paragraphs.length;i++){
    const row=overlay.paragraphs[i];paragraphs++;
    assert.equal(row.id,original.paragraphs[i].id);
    assert.equal(paragraphText(overlay,row),corpus[n-1].graded[i],`${grade} ${n}:${i+1}`);
    assert.equal(row.anchors.length,row.tokens.length);
    assert.equal(row.anchors.length,spans[String(n)][i].length);
   }
   grammarNotes+=Object.keys(overlay.grammarCards).filter(k=>k.startsWith('grammar-pass45-')).length;
   for(const note of notes.filter(note=>note.chapter===n)){
    assert.ok(corpus[n-1].graded[note.paragraph-1].includes(note.example));
    const cards=Object.values(overlay.grammarCards);
    assert.ok(cards.some(x=>x.pattern===`盘龙 ${n}.${note.paragraph} · ${note.pattern}`));
   }
  }
  assert.equal(paragraphs,1648);assert.equal(grammarNotes,40);
 }
});

test('v0.9.5 identity migration preserves existing reader preferences, bookmarks and study records',()=>{
 const sample={appVersion:'0.9.4',reader:{panlong:{chapters:[{editionPrefs:{graded:true,auto:true,minimum:.94},position:{id:'p1',offset:10}}],history:[{key:'term-林雷',grade:4}]}}};
 const result=prepareVersionedBackup(sample);
 assert.equal(result.appVersion,APP_VERSION);
 assert.deepEqual(result.reader,sample.reader);
 assert.equal(sample.appVersion,'0.9.4');
});
