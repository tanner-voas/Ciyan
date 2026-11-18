import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateChapter,chapterText} from '../reader-core.js';
const dir=new URL('../reader/panlong/',import.meta.url);
const locks=JSON.parse(fs.readFileSync(new URL('locked.json',dir)));
for(const [stem,sha] of Object.entries(locks)){
 const read=path=>fs.readFileSync(new URL(path,dir),'utf8');
 const original=read('original/'+stem+'.txt');
 const clean=original.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>x.replace(/\s*\d+\s*$/,'').trim()).join('\n\n');
 const reference=read('reference/'+stem+'.txt');
 assert.equal(createHash('sha256').update(reference).digest('hex'),sha,'Reference lock changed: '+stem);
 assert.equal(clean,reference,'Unexpected edits to source: '+stem);
 const p=JSON.parse(read('chapters/'+stem+'.json'));
 const all=validateChapter(p);
 assert.equal(p.number,Number(stem));assert.equal(p.novel,'panlong');
 assert.equal(chapterText(p),reference,'Reading text drift: '+stem);
 console.log(stem,p.title,p.paragraphs.length,'paragraphs,',p.authored.length,'authored items,',all.length,'distinct words and terms. Text matches.');
}
