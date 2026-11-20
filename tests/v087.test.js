import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {catalog,downloadChapter} from '../chapter-download.js';
import {validateChapter,chapterText,acceptChapter,readerAnalysis} from '../reader-core.js';
import {defaultState} from '../storage.js';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';
const root=new URL('../reader/panlong/',import.meta.url);
const read=(file)=>fs.readFileSync(new URL(file,root));
const load=n=>JSON.parse(read(`chapters/${String(n).padStart(3,'0')}.json`));
const digest=data=>createHash('sha256').update(data).digest('hex');

test('v0.8.9 retains all Panlong chapter text with upgraded lexicon and grammar metadata',()=>{
 assert.equal(APP_VERSION,'0.8.10');
 assert.equal(catalog.length,26);
 assert.deepEqual(catalog.filter(x=>x.novel==='panlong').map(x=>x.number),Array.from({length:23},(_,i)=>i+1));
 for(let n=12;n<=23;n++){
  const data=read(`chapters/${String(n).padStart(3,'0')}.json`),entry=catalog.find(x=>x.novel==='panlong'&&x.number===n),p=JSON.parse(data);
  assert.equal(digest(data),entry.digest);assert.equal(data.length,entry.size);
  assert.equal(entry.file,`panlong-${n}.zip`);
  assert.equal(entry.volumeTitle,'盘龙之戒');
  assert.equal(p.author,'我吃西红柿');assert.equal(p.volume,1);
 }
});
test('all new chapters reproduce the user-provided source prose character-for-character',()=>{
 for(let n=12;n<=23;n++){
  const stem=String(n).padStart(3,'0');
  const source=read(`volume-1-raw/${stem}.txt`).toString().replace(/\r\n/g,'\n').trimEnd();
  const [header,...body]=source.split('\n\n');
  assert.equal(header.split('\n')[0],'第一集 盘龙之戒');
  const original=[header.split('\n')[1],...body].join('\n\n');
  const p=load(n);
  validateChapter(p);
  assert.equal(chapterText(p),original,`Source-text drift in chapter ${n}`);
  assert.equal(read(`reference/${stem}.txt`).toString(),original);
  assert.equal(p.paragraphs.length,body.length);
 }
});
test('chapter-specific grammar and terms are substantial, evidence-grounded and recur across chapters',()=>{
 const grammar=JSON.parse(read('volume-1-grammar-12-23.json'));
 let total=0;
 const focused=new Map();
 for(let n=12;n<=23;n++){
  const p=load(n),source=chapterText(p);
  const terms=p.focus.filter(id=>id.startsWith('term-'));
  const patterns=p.focus.filter(id=>id.startsWith('grammar-'));
  assert.ok(terms.length>=15,`Chapter ${n} has only ${terms.length} terms`);
  assert.ok(patterns.length>=6,`Chapter ${n} has only ${patterns.length} grammar patterns`);
  assert.ok(!Object.hasOwn(p,'authored'));
  assert.ok(p.focus.every(id=>p.items[id].kind!=='vocab'));
  assert.ok(terms.every(id=>p.paragraphs.some(row=>row.tokens.some(t=>Array.isArray(t)&&t[0]===id))));
  for(const id of patterns){
   const name=id.slice('grammar-'.length);
   assert.ok(grammar.chapters[n].includes(name));
   assert.ok(p.items[id].english.length>35);
  }
  for(const id of terms){focused.set(id,(focused.get(id)||0)+1);total++;}
 }
 assert.ok(total>=250,`Only ${total} focused term appearances`);
 assert.ok(focused.get('term-林雷')>=12,'Linley should be focused anew in every chapter');
 assert.ok(focused.get('term-德林柯沃特')>=5,'Delin must recur in the magic training chapters');
 assert.ok(focused.get('term-圣域魔导师')>=5,'Repeated magic-system terminology must be retained');
});
test('sequentially loading all 23 chapters preserves existing term identities and focus priorities',()=>{
 const state=defaultState();
 for(let n=1;n<=23;n++){
  const p=load(n),entry=catalog.find(x=>x.novel==='panlong'&&x.number===n);
  acceptChapter(state,p,entry.digest);
 }
 const book=state.reader.panlong;
 assert.equal(book.current,23);assert.equal(book.chapters.length,23);
 assert.ok(book.items['term-林雷']);assert.ok(book.items['term-德林柯沃特']);
 for(let n=12;n<=23;n++){
  const c=book.chapters[n-1],analysis=readerAnalysis(state,book,c);
  assert.ok(analysis.focus.has('term-林雷'));
  assert.ok(analysis.queue.some(id=>id.startsWith('grammar-')));
  assert.deepEqual(c.focus,load(n).focus);
 }
});
test('all new ZIP packages inflate to the exact integrity-checked original JSON',async t=>{
 t.mock.method(globalThis,'fetch',async url=>new Response(fs.readFileSync(url)));
 for(let n=12;n<=23;n++){
  const entry=catalog.find(x=>x.novel==='panlong'&&x.number===n);
  assert.deepEqual(Buffer.from(await downloadChapter(entry)),read(`chapters/${String(n).padStart(3,'0')}.json`));
 }
});
test('old v0.8.6 backups migrate through an identity step without changing progress',()=>{
 const previous={format:'ciyan-backup',version:2,appVersion:'0.8.6',state:{reader:{panlong:{current:11,chapters:[],history:[{key:'term-林雷',grade:3}],progress:{}}}}};
 const upgraded=prepareVersionedBackup(previous);
 assert.equal(upgraded.appVersion,'0.8.10');assert.deepEqual(upgraded.state,previous.state);
});
test('chapter study prompt has independent length-aware typography and safe wrapping',()=>{
 const reader=fs.readFileSync(new URL('../reader-ui.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(reader,/reader-study-prompt--\$\{size\}/);
 assert.match(reader,/item\.kind==='grammar'\|\|length>10/);
 assert.match(css,/\.reader-study-prompt\{[^}]*overflow-wrap:anywhere/);
 assert.match(css,/\.reader-study-prompt--extended\{font-size:clamp\(23px/);
 assert.match(css,/\.reader-vocab-row--long\{grid-template-columns:minmax\(0,1fr\)/);
});
