// No browser or npm dependencies: runs the app's real UI handlers with a minimal
// IndexedDB + DOM mock. Complements the scheduler tests; not an iOS Safari test.
import test from 'node:test';
import assert from 'node:assert/strict';

const delay = (ms=4) => new Promise(resolve=>setTimeout(resolve,ms));

const sharedData=new Map();
function mockBrowser() {
  const data=sharedData; data.clear();
  const listeners={};
  const shell={innerHTML:''};
  const toast={textContent:'',classList:{add(){},remove(){}}};
  const browseNodes=Object.fromEntries(['#tag-filter','#active-tag-filter','#collection-list','#browse-count'].map(k=>[k,{innerHTML:'',textContent:''}]));
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
    await mock.listeners.click({target:{closest:(selector)=>selector==='[data-action]'?element:null}});
    await delay(5);
  };
  await click('start');
  assert.match(mock.shell.innerHTML,/review-card/);
  for(let i=0;i<12;i++){
    await click('reveal');
    assert.match(mock.shell.innerHTML,/Again/);
    await click('grade',{grade:'3'});
  }
  assert.match(mock.shell.innerHTML,/Protect your progress/);
  const state=mock.data.get('main');
  assert.equal(state.history.length,12);
  assert.equal(state.sessions.length,1);
  assert.equal(state.activeSession,null);
  assert.ok(state.revision>state.backedUpRevision);
  await click('navigate',{page:'stats'});
  assert.match(mock.shell.innerHTML,/Vocab reviews/);
  assert.match(mock.shell.innerHTML,/>12</);
  await click('navigate',{page:'settings'});
  assert.match(mock.shell.innerHTML,/Restore full backup/);
  assert.match(mock.shell.innerHTML,/Unlimited/);
  await click('navigate',{page:'browse'});
  assert.match(mock.shell.innerHTML,/Every word/);
  await click('navigate',{page:'grammar'});
  assert.match(mock.shell.innerHTML,/Words in/);
});

test('grammar mode unlocks known sentences and saves ordering results',async()=>{
  const mock=mockBrowser();
  const {defaultState}=await import('../storage.js');
  const {scheduleReview}=await import('../fsrs.js');
  const source=defaultState();
  for(const c of source.cards)source.schedules[c.id]=scheduleReview(null,3,Date.now());
  mock.data.set('main',source);
  await import('../app.js?smoke=grammar');await delay(25);
  assert.match(mock.shell.innerHTML,/4 of 4 grammar examples unlocked/);
  const click=async(action,extra={})=>{
    const el={dataset:{action,...extra}};
    await mock.listeners.click({target:{closest:(query)=>query==='[data-action]'?el:null}});
    await delay();
  };
  await click('start',{mode:'grammar'});
  assert.match(mock.shell.innerHTML,/GRAMMAR LAB/);
  for(let i=0;i<5;i++)await click('grammar-pick',{tile:`t${i}`});
  await click('grammar-check');
  assert.match(mock.shell.innerHTML,/CORRECT SENTENCE/);
  assert.equal(mock.data.get('main').grammarHistory[0].correct,true);
  assert.equal(mock.data.get('main').activeGrammarSession.queue.length,3);
  await click('next-grammar');
  assert.match(mock.shell.innerHTML,/WORD BANK/);
});

test('tone enforcement prevents Easy and records an incorrect tone answer',async()=>{
  const mock=mockBrowser();
  const {defaultState}=await import('../storage.js');
  const source=defaultState();source.settings.toneTest=true;source.settings.enforceTones=true;
  mock.data.set('main',source);
  await import('../app.js?smoke=tones');await delay(25);
  const click=async(action,extra={})=>{
    const el={dataset:{action,...extra}};
    await mock.listeners.click({target:{closest:(query)=>query==='[data-action]'?el:null}});
    await delay();
  };
  await click('start',{mode:'words'});
  assert.match(mock.shell.innerHTML,/tone-grid/);
  assert.doesNotMatch(mock.shell.innerHTML,/review-english/);
  await click('reveal');
  assert.match(mock.shell.innerHTML,/disabled/);
  await click('grade',{grade:'4'});
  assert.equal(mock.data.get('main').history.length,0);
  await click('grade',{grade:'3'});
  assert.equal(mock.data.get('main').history.length,1);
  assert.equal(mock.data.get('main').history[0].toneResult.correct,false);
});
