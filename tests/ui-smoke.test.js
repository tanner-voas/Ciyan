// No browser or npm dependencies: runs the app's real UI handlers with a minimal
// IndexedDB + DOM mock. Complements the scheduler tests; not an iOS Safari test.
import test from 'node:test';
import assert from 'node:assert/strict';

const delay = (ms=4) => new Promise(resolve=>setTimeout(resolve,ms));

function mockBrowser() {
  const data=new Map();
  const listeners={};
  const shell={innerHTML:''};
  const toast={textContent:'',classList:{add(){},remove(){}}};
  const browseNodes=Object.fromEntries(['#tag-filter','#word-list','#browse-count'].map(k=>[k,{innerHTML:'',textContent:''}]));
  const body={append(){}};
  const fakeDb={
    objectStoreNames:{contains:()=>true},
    transaction(){
      const tx={oncomplete:null,onerror:null,onabort:null};
      tx.objectStore=()=>({
        get(key){const request={onsuccess:null,onerror:null,result:data.get(key)};queueMicrotask(()=>request.onsuccess?.());return request;},
        put(value,key){data.set(key,structuredClone(value));queueMicrotask(()=>tx.oncomplete?.());}
      });return tx;
    }
  };
  globalThis.indexedDB={open(){const request={result:fakeDb,onsuccess:null,onerror:null,onupgradeneeded:null};queueMicrotask(()=>request.onsuccess?.());return request;}};
  globalThis.document={
    body,
    querySelector:sel=>sel==='#app'?shell:sel==='#toast'?toast:(browseNodes[sel]||null),
    addEventListener:(type,fn)=>listeners[type]=fn,
    createElement:()=>({className:'',innerHTML:'',remove(){},querySelector:()=>null})
  };
  Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
  globalThis.window={scrollTo(){},confirm:()=>true};
  globalThis.location={protocol:'file:'};
  return {shell,listeners,data};
}

test('UI renders, reviews persist, session finishes with backup reminder',async()=>{
  const mock=mockBrowser();
  await import('../app.js?smoke=1');
  await delay(25);
  assert.match(mock.shell.innerHTML,/Little words/);
  assert.match(mock.shell.innerHTML,/Due now/);
  const click=async(action, extra={})=>{
    const element={dataset:{action,...extra}};
    await mock.listeners.click({target:{closest:()=>element}});
    await delay(5);
  };
  await click('start');
  assert.match(mock.shell.innerHTML,/review-card/);
  for(let i=0;i<8;i++){
    await click('reveal');
    assert.match(mock.shell.innerHTML,/Again/);
    await click('grade',{grade:'3'});
  }
  assert.match(mock.shell.innerHTML,/Protect your progress/);
  const state=mock.data.get('main');
  assert.equal(state.history.length,8);
  assert.equal(state.sessions.length,1);
  assert.equal(state.activeSession,null);
  assert.ok(state.revision>state.backedUpRevision);
  await click('navigate',{page:'stats'});
  assert.match(mock.shell.innerHTML,/Total reviews/);
  assert.match(mock.shell.innerHTML,/>8</);
  await click('navigate',{page:'settings'});
  assert.match(mock.shell.innerHTML,/Restore full backup/);
  await click('navigate',{page:'browse'});
  assert.match(mock.shell.innerHTML,/Every word/);
});
