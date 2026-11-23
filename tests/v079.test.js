import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {catalog} from '../chapter-download.js';
import {novelLibrary,volumeList,chaptersInVolume,volumeLabel,registerCustomChapter,validateReaderCustomIndex} from '../reader-library.js';
import {defaultState,parseBackup,migrateState} from '../storage.js';
import {prepareVerifiedBackup} from '../backup-integrity.js';
import {acceptChapter,chapterText,validateChapter} from '../reader-core.js';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';

const content=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
test('v0.7.9 includes 11 linear Panlong chapters under V01; existing three digests unchanged',()=>{
 assert.equal(APP_VERSION,'0.9.7');
 assert.equal(catalog.length,26);
 const entries=catalog.filter(c=>c.novel==='panlong');
 assert.deepEqual(entries.map(c=>c.number),Array.from({length:23},(_,i)=>i+1));
 assert.ok(entries.every(c=>c.volume===1&&c.volumeTitle==='盘龙之戒'&&c.author==='我吃西红柿'));
 assert.ok([entries[0].previousDigest,...(entries[0].previousDigests||[])].includes('adf543c915356f94e96968182122b751613ab833f2899bab7b477198772ccb03'));
 assert.ok([entries[1].previousDigest,...(entries[1].previousDigests||[])].includes('3f55cdbe9546326fd162ee0488f59911752285d0e56e8d50f687246e914ab333'));
 assert.ok([entries[2].previousDigest,...(entries[2].previousDigests||[])].includes('351696f3e4f993ee4360e6cc329ff856c92f0dac83580877aa6aedaa2056d2cc'));
});
test('new reader packages preserve uploaded chapter prose exactly',()=>{
 for(let n=4;n<=11;n++){
  const name=String(n).padStart(3,'0');
  const original=content(`../reader/panlong/new-raw/${name}.txt`).trimEnd();
  const reference=original.split('\n\n').slice(0,1)[0].split('\n').slice(-1)[0]+'\n\n'+original.split('\n\n').slice(1).join('\n\n');
  const chapter=JSON.parse(content(`../reader/panlong/chapters/${name}.json`));
  assert.deepEqual(validateChapter(chapter).length>100,true);
  const locked=JSON.parse(content('../reader/panlong/pass45/corpus.json'))[n-1];
  assert.equal([locked.title,...locked.archival].join('\n\n'),reference,`chapter ${n} archival fidelity`);
  assert.equal(chapterText(chapter),[locked.title,...locked.original].join('\n\n'));
  assert.ok(chapter.focus.length>=5,`chapter ${n} has critical terms and grammar`);
  assert.ok(chapter.focus.every(id=>chapter.items[id].kind!=='vocab'));
  assert.ok(chapter.focus.some(id=>id.startsWith('grammar-')));
  assert.ok(!('authored' in chapter));
  const file=fs.readFileSync(new URL(`../reader/panlong/chapters/${name}.json`,import.meta.url));
  const manifest=catalog.find(c=>c.novel==='panlong'&&c.number===n);
  assert.equal(createHash('sha256').update(file).digest('hex'),manifest.digest);
 }
});
test('all eleven Panlong chapters import sequentially into one novel without dictionary identity conflicts',()=>{
 const state=defaultState();
 const imported=[];
 for(let n=1;n<=11;n++){
  const name=String(n).padStart(3,'0');
  const bytes=Buffer.from(content(`../reader/panlong/chapters/${name}.json`));
  const chapter=JSON.parse(bytes.toString());
  const digest=createHash('sha256').update(bytes).digest('hex');
  acceptChapter(state,chapter,digest);
  imported.push(chapter.number);
 }
 assert.deepEqual(imported,Array.from({length:11},(_,i)=>i+1));
 assert.equal(state.reader.panlong.current,11);
 assert.equal(state.reader.panlong.chapters.length,11);
 assert.equal(state.reader.panlong.chapters[0].number,1);
 assert.equal(state.reader.panlong.chapters[10].number,11);
});
test('novels are displayed as author then title and sample stories group by TSK level',()=>{
 const books=novelLibrary(defaultState());
 assert.deepEqual(books.map(b=>b.title),['TSK1 samples','TSK2 samples','TSK3 samples','盘龙']);
 assert.deepEqual(books.map(b=>b.author),['Cíyán','Cíyán','Cíyán','我吃西红柿']);
 assert.deepEqual(volumeList(books[3]),[{number:1,title:'盘龙之戒',label:'V01 · 盘龙之戒'}]);
 assert.equal(volumeList(books[0]).length,0);
 const css=content('../styles.css');
 assert.match(css,/\.reader-choices\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
 const reader=content('../reader-ui.js');
 assert.match(reader,/id="reader-volume"/);
 assert.match(reader,/esc\(x\.author\)\} • \$\{esc\(x\.title\)/);
});
test('V02 follows V01 in the same novel without changing global chapter identity',()=>{
 const chapters=[
  {number:9,volume:1,volumeTitle:'First'},
  {number:10,volume:1,volumeTitle:'First'},
  {number:11,volume:2,volumeTitle:'Second'},
  {number:12,volume:2,volumeTitle:'Second'}
 ];
 const book={chapters};
 assert.deepEqual(volumeList(book).map(v=>v.label),['V01 · First','V02 · Second']);
 assert.deepEqual(chaptersInVolume(book,2).map(c=>c.number),[11,12]);
 assert.equal(volumeLabel(2,'Second'),'V02 · Second');
 assert.equal(chapters[1].number+1,chapters[2].number);
});
test('custom author and volume metadata survive backup without adding new progress locks',()=>{
 const chapter=JSON.parse(content('../reader/panlong/chapters/004.json'));
 chapter.novel='my-custom-novel';chapter.book='My novel';chapter.author='Example Author';
 chapter.volume=2;chapter.volumeTitle='Later book';chapter.number=1;
 const bytes=Buffer.from(JSON.stringify(chapter));const digest=createHash('sha256').update(bytes).digest('hex');
 const state=defaultState();acceptChapter(state,chapter,digest);registerCustomChapter(state,chapter,digest);
 const saved=parseBackup(JSON.parse(prepareVerifiedBackup(state).json));
 const book=novelLibrary(saved).find(b=>b.novel==='my-custom-novel');
 assert.equal(book.author,'Example Author');
 assert.equal(book.chapters[0].volume,2);
 assert.equal(book.chapters[0].volumeTitle,'Later book');
 assert.deepEqual(validateReaderCustomIndex(saved.readerCustomIndex),saved.readerCustomIndex);
 assert.ok(!JSON.stringify(saved.reader).includes('paragraphs'));
 assert.ok(!JSON.stringify(saved.readerCustomIndex).includes('tokens'));
 const older=defaultState();older.appVersion='0.7.8';
 assert.equal(prepareVersionedBackup(older).appVersion,'0.9.7');
});
