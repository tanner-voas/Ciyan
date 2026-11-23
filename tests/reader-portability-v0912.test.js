import test from 'node:test';
import assert from 'node:assert/strict';
import {collectCustomReaderText,restoreCustomReaderText,customReaderEntries} from '../reader-portability.js';
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');
test('portable imported text can be collected, cleared and restored on a cold device',async()=>{
 const old={caches:globalThis.caches,location:globalThis.location};const content=JSON.stringify({novel:'test-book',number:1,title:'Chapter',paragraphs:[]});
 const hash=await digest(content),data=new Map();
 globalThis.location={href:'https://host.test/?app=ciyan'};
 globalThis.caches={open:async()=>({match:async key=>data.has(key)?new Response(data.get(key)):null,put:async(key,val)=>data.set(key,await val.text())})};
 const state={readerCustomIndex:{'test-book':{title:'Book',chapters:[{number:1,title:'Chapter',revision:1,digest:hash}]}}};
 try{
  assert.equal(customReaderEntries(state).length,1);
  const url=new URL('./reader-content/'+hash,globalThis.location.href).href;
  data.set(url,content);
  const collected=await collectCustomReaderText(state);
  assert.equal(collected[hash],content);
  data.clear();assert.equal(await restoreCustomReaderText(state,collected),1);
  assert.deepEqual(await collectCustomReaderText(state),collected);
  await assert.rejects(restoreCustomReaderText(state,{[hash]:content+'tamper'}),/integrity/);
  assert.equal(data.get(url),content);
 }finally{for(const [key,val] of Object.entries(old)){if(val===undefined)delete globalThis[key];else globalThis[key]=val;}}
});
