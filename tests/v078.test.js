import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {defaultState,parseBackup,migrateState} from '../storage.js';
import {prepareVerifiedBackup} from '../backup-integrity.js';
import {acceptChapter} from '../reader-core.js';
import {defaultTagWeight,TSK_DEFAULTS} from '../tag-weights.js';
import {novelLibrary,registerCustomChapter,validateReaderCustomIndex,matchesRequestedChapter} from '../reader-library.js';
import {APP_VERSION} from '../backup-versions.js';

const fixture=JSON.parse(fs.readFileSync(new URL('../reader/panlong/chapters/001.json',import.meta.url),'utf8'));
const digest=createHash('sha256').update(fs.readFileSync(new URL('../reader/panlong/chapters/001.json',import.meta.url))).digest('hex');

test('0.7.8 has the requested 9 non-neutral TSK defaults and preserves custom weights',()=>{
 assert.equal(APP_VERSION,'0.7.8');
 assert.deepEqual(Object.values(TSK_DEFAULTS),[2560,1280,640,320,160,80,40,20,10]);
 assert.equal(defaultTagWeight('TSK/TSK5'),160);
 assert.equal(defaultTagWeight('Topics/anything'),0);
 const older=defaultState();older.appVersion='0.7.7';
 for(const key of Object.keys(TSK_DEFAULTS))older.settings.tagWeights[key]=0;
 const migrated=migrateState(older);
 for(const [key,value] of Object.entries(TSK_DEFAULTS))assert.equal(migrated.settings.tagWeights[key],value);
 const personalized=structuredClone(older);personalized.settings.tagWeights['TSK/TSK3']=25;
 assert.equal(migrateState(personalized).settings.tagWeights['TSK/TSK1'],0);
 assert.equal(migrateState(personalized).settings.tagWeights['TSK/TSK3'],25);
});

test('remote master index and custom chapter index form a combined library',()=>{
 const state=defaultState();
 const books=novelLibrary(state);
 assert.deepEqual(books.map(b=>b.novel),['panlong','takeaway','two-cups','which-exit']);
 assert.equal(books[0].chapters.length,3);
 assert.ok(books[0].chapters.every(c=>c.source==='master'));
 const own={...fixture,novel:'my-novel',book:'我的小说',title:'第一章'};
 acceptChapter(state,own,digest);
 registerCustomChapter(state,own,digest);
 assert.equal(novelLibrary(state).find(b=>b.novel==='my-novel').chapters[0].source,'custom');
 assert.throws(()=>validateReaderCustomIndex({constructor:{title:'bad',chapters:[]}}),/Invalid custom novel/);
 assert.throws(()=>validateReaderCustomIndex({valid:{title:'Title',chapters:[{number:1,title:'Chapter',digest:'x',revision:1}]}}),/Invalid custom chapter/);
});

test('backup contains custom chapter metadata but never chapter prose',()=>{
 const state=defaultState();
 const custom={...fixture,novel:'my-novel',book:'我的小说',title:'第一章'};
 acceptChapter(state,custom,digest);registerCustomChapter(state,custom,digest);
 state.reader['my-novel'].chapters[0].unlocked=true;
 state.reader['my-novel'].chapters[0].position={id:custom.paragraphs[0].id,index:0,offset:1};
 const saved=JSON.parse(prepareVerifiedBackup(state).json);
 assert.equal(saved.state.readerCustomIndex['my-novel'].chapters[0].digest,digest);
 assert.ok(!JSON.stringify(saved.state.readerCustomIndex).includes('tokens'));
 assert.ok(!JSON.stringify(saved.state.reader).includes('tokens'));
 const parsed=parseBackup(saved);
 assert.deepEqual(parsed.readerCustomIndex,state.readerCustomIndex);
 assert.equal(parsed.reader['my-novel'].chapters[0].position.offset,1);
 assert.equal(novelLibrary(parsed).find(b=>b.novel==='my-novel').chapters[0].title,'第一章');
});

test('settings are separate collapsed sections, with an always-visible About section',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/details class="settings-section"/);
 assert.match(app,/group\('Chinese fonts'/);
 assert.match(app,/group\('Reader'/);
 assert.match(app,/section-title">About Cíyán/);
 const styles=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(styles,/reader-ui-hidden/);
 assert.match(styles,/reader-finish-next/);
});

test('offline cache and Cloudflare build contain the new reader index',()=>{
 const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const packager=fs.readFileSync(new URL('../package.py',import.meta.url),'utf8');
 assert.match(sw,/\.\/reader-library\.js/);
 assert.match(packager,/reader-library\.js/);
});

test('missing custom chapter prompt only accepts the matching file or newer revision',()=>{
 const request={novel:'my-novel',number:1,title:'第一章',revision:1,digest};
 const chapter={...fixture,novel:'my-novel'};
 assert.equal(matchesRequestedChapter(chapter,request,digest),true);
 assert.equal(matchesRequestedChapter(chapter,request,'0'.repeat(64)),false);
 assert.equal(matchesRequestedChapter({...chapter,number:2},request,digest),false);
 assert.equal(matchesRequestedChapter({...chapter,novel:'another'},request,digest),false);
 assert.equal(matchesRequestedChapter({...chapter,revision:2},request,'0'.repeat(64)),true);
 assert.equal(matchesRequestedChapter(chapter,null,digest),true);
});
