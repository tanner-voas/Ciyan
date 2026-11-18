import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultState,saveState,loadState,cloneProgressState,makeBackup} from '../storage.js';

function fakeIndexedDb(){
 const data=new Map(),writes=[];
 const db={
  objectStoreNames:{contains:()=>true},
  transaction(){
   const tx={oncomplete:null,onerror:null,onabort:null,abort(){queueMicrotask(()=>tx.onabort?.());}};
   tx.objectStore=()=>({
    get(key){const request={onsuccess:null,onerror:null,result:structuredClone(data.get(key))};queueMicrotask(()=>request.onsuccess?.());return request;},
    put(value,key){writes.push(key);data.set(key,structuredClone(value));queueMicrotask(()=>tx.oncomplete?.());},
    delete(key){writes.push('delete:'+key);data.delete(key);queueMicrotask(()=>tx.oncomplete?.());}
   });return tx;
  }
 };
 globalThis.indexedDB={open(){const request={result:db,onsuccess:null,onerror:null,onupgradeneeded:null};queueMicrotask(()=>request.onsuccess?.());return request;}};
 return {data,writes};
}
test('atomic master + chunked history storage round-trips and updates only the final log block',async()=>{
 const {data,writes}=fakeIndexedDb();
 const original=defaultState();original.cards=[{...original.cards[0]}];original.grammar=[{...original.grammar[0]}];
 original.history=Array.from({length:600},(_,i)=>({id:`r-${i}`,cardId:original.cards[0].id,grade:3,at:new Date(Date.UTC(2026,10,18,i%24)).toISOString()}));
 await saveState(original,null);
 assert.equal(data.has('master-content'),true);
 assert.equal(data.get('main').__historyChunks.history,3);
 assert.equal(data.get('main').history,undefined);
 assert.equal(writes.filter(k=>k.startsWith('log:history:')).length,3);
 let restored=await loadState();assert.deepEqual(restored.history,original.history);
 assert.equal(restored.cards.length,1);assert.equal(restored.grammar.length,1);
 writes.length=0;
 const next=cloneProgressState(restored);next.history.push({id:'r-600',cardId:original.cards[0].id,grade:4,at:'2026-11-18T23:30:00.000Z'});
 next.revision=1;
 await saveState(next,0);
 assert.deepEqual(writes.filter(k=>k.startsWith('log:history:')),['log:history:2']);
 assert.equal(writes.includes('master-content'),false);
 assert.equal(writes.includes('main'),true);
 restored=await loadState();assert.equal(restored.history.length,601);assert.equal(restored.history.at(-1).id,'r-600');
 assert.equal(makeBackup(restored).state.history.length,601);
 writes.length=0;
 const cleared=cloneProgressState(restored);cleared.history=[];cleared.revision=2;
 await saveState(cleared,1);
 assert.equal(writes.filter(k=>k.startsWith('delete:log:history:')).length,3);
 const final=await loadState();assert.equal(final.history.length,0);
 assert.equal(final.cards.length,1);
});
