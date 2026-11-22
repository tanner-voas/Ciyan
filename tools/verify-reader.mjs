import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateChapter,chapterText} from '../reader-core.js';
import catalog from '../chapters/index.js';
const dir=new URL('../reader/panlong/',import.meta.url),read=path=>fs.readFileSync(new URL(path,dir),'utf8');
const locks=JSON.parse(read('locked.json')),corpus=JSON.parse(read('pass45/corpus.json'));
for(const c of corpus){
 const stem=String(c.number).padStart(3,'0'),reference=read('reference/'+stem+'.txt');
 assert.equal(createHash('sha256').update(reference).digest('hex'),locks[stem]);
 assert.equal(reference,[c.title,...c.original].join('\n\n'));
 const raw=read('chapters/'+stem+'.json'),p=JSON.parse(raw),entry=catalog.find(e=>e.novel==='panlong'&&e.number===c.number);
 const {default:asset}=await import('../chapters/'+entry.gradedFile);
 assert.equal(createHash('sha256').update(raw).digest('hex'),entry.digest);assert.equal(asset.sourceDigest,entry.digest);
 validateChapter(p);validateChapter({...p,...asset});
 assert.equal(chapterText(p),reference);assert.equal(chapterText({...p,...asset}),[c.title,...c.graded].join('\n\n'));
 console.log(stem,c.title,c.original.length,'aligned paragraphs. Both editions verified.');
}
