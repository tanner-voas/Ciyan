import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {catalog,downloadChapter} from '../chapter-download.js';
import {validateChapter} from '../reader-core.js';
test('all six hosted ZIPs decompress to the original importable JSON bytes',async t=>{
 t.mock.method(globalThis,'fetch',async url=>new Response(await fs.readFile(url)));
 assert.equal(catalog.length,6);
 for(const entry of catalog){
  const bytes=await downloadChapter(entry);
  const path=entry.novel==='panlong'?'panlong/chapters/'+String(entry.number).padStart(3,'0'):'samples/'+entry.novel;
  assert.deepEqual(Buffer.from(bytes),await fs.readFile(new URL('../reader/'+path+'.json',import.meta.url)));
  const p=JSON.parse(new TextDecoder().decode(bytes));validateChapter(p);
  assert.equal(p.title,entry.title);assert.equal(p.novel,entry.novel);
 }
 await assert.rejects(downloadChapter({...catalog[0],digest:'broken'}),/integrity/);
});
test('catalog opens later chapters in order and recovers a saved bookmark after clearing the text cache',async t=>{
 const {createReader}=await import('../reader-ui.js');
 const state={reader:{},settings:{readerGate:'authored'},cards:[],schedules:{}};
 const cache=new Map(),errors=[];
 t.mock.method(globalThis,'fetch',async url=>new Response(await fs.readFile(url)));
 globalThis.document={addEventListener(){}};
 globalThis.location={href:'https://example.test/sub/app/'};
 globalThis.caches={open:async()=>({put:(k,v)=>cache.set(k,v),match:k=>cache.get(k)?.clone()})};
 const ui=createReader({state:()=>state,esc:String,render(){},toast:m=>errors.push(m),change:async fn=>{fn(state);return true;}});
 assert.match(ui.view(),/id="reader-novel"/);
 assert.doesNotMatch(ui.view(),/Chapter catalog/);
 await ui.action('catalog',{dataset:{file:'panlong-3.zip'}});
 const b=state.reader.panlong;
 assert.equal(b.current,3);assert.equal(b.chapters.length,3);
 const last=b.chapters[2];last.unlocked=true;last.position={id:'p1',index:0,wordIndex:2,offset:3,guided:true};
 ui.reset();cache.clear();ui.view();
 await ui.action('read',{dataset:{}});
 assert.match(ui.view(),/id="reader-pages"/);
 assert.equal(last.position.wordIndex,2);
 assert.deepEqual(errors,[]);
});
