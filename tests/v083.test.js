import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateChapter,chapterText,acceptChapter,readerAnalysis,chapterFocus,validateReader} from '../reader-core.js';
import {novelLibrary,registerCustomChapter} from '../reader-library.js';
import {defaultState,parseBackup,migrateState} from '../storage.js';
import {prepareVerifiedBackup} from '../backup-integrity.js';
import {catalog} from '../chapter-download.js';
const root=new URL('../',import.meta.url);
const file=path=>fs.readFileSync(new URL(path,root));
const entries=[...Array.from({length:11},(_,i)=>({path:`reader/panlong/chapters/${String(i+1).padStart(3,'0')}.json`,novel:'panlong',number:i+1})),
 ...['two-cups','which-exit','takeaway'].map(n=>({path:`reader/samples/${n}.json`,novel:n,number:1}))];

test('all fourteen chapters use auto vocabulary and critical term/grammar focus, without altering the source prose',()=>{
 for(const {path,novel,number} of entries){
  const p=JSON.parse(file(path));
  assert.equal(p.novel,novel);assert.equal(p.number,number);
  assert.ok(!Object.hasOwn(p,'authored'),`${path} still contains an authored list`);
  assert.ok(p.focus.length>=2,`${path} has no focused study set`);
  assert.ok(p.focus.some(id=>p.items[id].kind==='grammar'),`${path} lacks chapter grammar`);
  assert.ok(p.focus.every(id=>['term','grammar'].includes(p.items[id].kind)));
  assert.equal(new Set(p.focus).size,p.focus.length);
  const all=validateChapter(p);assert.ok(all.length>10);
  if(novel==='panlong'){
   assert.equal(chapterText(p),file(`reader/panlong/reference/${String(number).padStart(3,'0')}.txt`).toString());
   const usedTerms=Object.entries(p.items).filter(([id,item])=>item.kind==='term'&&all.includes(id)).map(([id])=>id);
   assert.ok(usedTerms.every(id=>p.focus.includes(id)),`${path} omitted a fantasy term`);
   if(number>=4)assert.ok(p.focus.filter(id=>p.items[id].kind==='grammar').length>=3);
  }
  const manifest=catalog.find(c=>c.novel===novel&&c.number===number);
  assert.ok(manifest);
  assert.equal(manifest.digest,createHash('sha256').update(file(path)).digest('hex'));
  assert.equal(manifest.size,file(path).length);
  assert.ok(manifest.previousDigest,`${path} has no prior digest for cached updates`);
 }
});

test('HSK4 is the automatic base, while advanced/unclassified vocabulary and critical grammar remain visible',()=>{
 const p=JSON.parse(file('reader/panlong/chapters/001.json'));
 const s=defaultState();acceptChapter(s,p,catalog.find(c=>c.novel==='panlong'&&c.number===1).digest);
 const b=s.reader.panlong,c=b.chapters[0],a=readerAnalysis(s,b,c);
 assert.ok(a.keys.length>=1000);
 assert.ok(!a.weak.includes('vocab-的'));
 assert.ok(a.weak.includes('vocab-斑驳'));
 assert.ok(a.weak.includes('grammar-即使……也……'));
 assert.ok(a.focus.has('term-乌山镇'));
 assert.ok(!a.focus.has('vocab-斑驳'));
 const card=s.cards.find(c=>c.hanzi==='的');
 if(card){s.schedules[card.id]={score:0,dueAt:new Date(Date.now()-60000).toISOString()};
  assert.ok(readerAnalysis(s,b,c).weak.includes('vocab-的'),'Recorded weakness must override the assumed baseline');}
});

test('v0.8.2 chapters and their reviews, unlocks and bookmarks migrate to focus lists without a vocabulary authored mode',()=>{
 const p=JSON.parse(file('reader/panlong/chapters/004.json'));
 const s=defaultState();
 for(let n=1;n<=3;n++){
  const c=JSON.parse(file(`reader/panlong/chapters/${String(n).padStart(3,'0')}.json`));
  acceptChapter(s,c,catalog.find(e=>e.novel==='panlong'&&e.number===n).digest);
 }
 const old=structuredClone(p);old.revision-=1;delete old.focus;
 old.authored=['vocab-父亲',...Object.keys(old.items).filter(id=>old.items[id].kind==='term').slice(0,2)];
 const oldHash='f'.repeat(64);validateChapter(old);acceptChapter(s,old,oldHash);
 const b=s.reader.panlong,oldChapter=b.chapters[3];oldChapter.unlocked=true;oldChapter.complete=true;
 oldChapter.position={id:p.paragraphs[0].id,index:0,offset:4,wordIndex:2,guided:true};
 b.progress[old.authored[1]]={score:3,dueAt:new Date(Date.now()+86400000).toISOString()};
 acceptChapter(s,p,catalog.find(e=>e.novel==='panlong'&&e.number===4).digest);
 assert.ok(b.chapters[3].complete&&b.chapters[3].unlocked);
 assert.equal(b.chapters[3].position.id,oldChapter.position.id);
 assert.ok(!Object.hasOwn(b.chapters[3],'authored'));
 assert.ok(b.chapters[3].focus.every(id=>b.items[id].kind!=='vocab'));
 assert.equal(b.progress[old.authored[1]].score,3);
 const restored=parseBackup(JSON.parse(prepareVerifiedBackup(s).json));
 assert.deepEqual(restored.reader,s.reader);
 assert.ok(!JSON.stringify(restored.reader).includes('"authored"'));
 assert.ok(!JSON.stringify(restored.reader).includes('"paragraphs"'));
 const outdated=structuredClone(s);outdated.settings.readerGate='authored';
 outdated.reader.panlong.chapters[3].authored=old.authored;delete outdated.reader.panlong.chapters[3].focus;
 const migrated=migrateState(outdated);
 assert.ok(!Object.hasOwn(migrated.settings,'readerGate'));
 assert.ok(!Object.hasOwn(migrated.reader.panlong.chapters[3],'authored'));
 assert.deepEqual(migrated.reader.panlong.chapters[3].focus,old.authored.filter(id=>b.items[id].kind!=='vocab'));
});

test('all historical master digests remain recognized as hosted chapters rather than custom imports',()=>{
 const s=defaultState();
 const entry=catalog.find(c=>c.novel==='panlong'&&c.number===4);
 assert.ok(entry.previousDigest);assert.ok(entry.previousDigests?.length);
 const fake={novel:'panlong',book:'盘龙',number:4,title:entry.title,revision:2};
 for(const digest of [entry.digest,entry.previousDigest,...entry.previousDigests])registerCustomChapter(s,fake,digest);
 assert.deepEqual(s.readerCustomIndex||{},{});
 const legacy=defaultState();legacy.reader.panlong={title:'盘龙',chapters:[{number:4,digest:entry.previousDigests[0]}],progress:{},history:[],current:4,items:{}};
 const listed=novelLibrary(legacy);
 assert.equal(listed.find(b=>b.novel==='panlong').chapters[3]?.source,'master');
});
