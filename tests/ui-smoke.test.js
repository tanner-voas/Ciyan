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
      const tx={oncomplete:null,onerror:null,onabort:null,abort(){queueMicrotask(()=>tx.onabort?.());}};
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
  return {shell,listeners,data,browseNodes,toast};
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
  assert.equal(state.mixedSessions.length,1);
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
  assert.match(mock.shell.innerHTML,/Grammar ·/);
  for(let i=0;i<5;i++)await click('practice-pick',{tile:`t${i}`});
  await click('practice-check');
  assert.match(mock.shell.innerHTML,/Correct target order/);
  await click('practice-grade',{grade:'3'});
  assert.equal(mock.data.get('main').grammarHistory[0].correct,true);
  assert.equal(mock.data.get('main').activePractice.results.length,1);
  assert.match(mock.shell.innerHTML,/grammar-bank/);
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


test('optional deck UI imports additively, paginates, filters and studies a topic',async()=>{
  const mock=mockBrowser();
  const fs=await import('node:fs');
  globalThis.fetch=async path=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../'+path.replace('./',''),import.meta.url)))});
  await import('../app.js?smoke=decks');await delay(25);
  const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
  await click('navigate',{page:'decks'});assert.match(mock.shell.innerHTML,/Pick your/);
  await click('load-deck',{deck:'all-decks'});
  const total=mock.data.get('main').cards.length;assert.ok(total>=1580);
  await click('load-deck',{deck:'all-decks'});assert.equal(mock.data.get('main').cards.length,total);
  await click('navigate',{page:'browse'});
  assert.equal((mock.browseNodes['#collection-list'].innerHTML.match(/class="list-card"/g)||[]).length,80);
  await click('more-words');assert.equal((mock.browseNodes['#collection-list'].innerHTML.match(/class="list-card"/g)||[]).length,160);
  await click('cycle-tag',{kind:'words',tag:'Activities/climbing'});
  assert.ok((mock.browseNodes['#collection-list'].innerHTML.match(/class="list-card"/g)||[]).length>=76);
  await click('study-filtered');
  const saved=mock.data.get('main');assert.ok(saved.activeSession.queue.every(id=>saved.cards.find(c=>c.id===id).tags.includes('Activities/climbing')));
});

test('stale tab cannot overwrite a newer revision or advance its review queue',async()=>{
  const mock=mockBrowser();await import('../app.js?smoke=conflict');await delay(25);
  const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
  await click('start');const before=structuredClone(mock.data.get('main'));
  const other=structuredClone(before);other.revision+=1;other.cards[0].english='Edited in another tab';mock.data.set('main',other);
  await click('reveal');await click('grade',{grade:'3'});
  assert.deepEqual(mock.data.get('main'),other);assert.match(mock.toast.textContent,/another tab/);
  assert.match(mock.shell.innerHTML,/review-card/);
});

test('grammar detail escapes imported distractor text',async()=>{
  const mock=mockBrowser();const {defaultState}=await import('../storage.js');const source=defaultState();
  source.grammar[0].distractors=[{index:1,word:'<img src=x onerror=alert(1)>'}];mock.data.set('main',source);
  let modalContent='';document.body.append=node=>{modalContent=node.innerHTML;};
  await import('../app.js?smoke=escape');await delay(25);
  const el={dataset:{action:'grammar-detail',id:source.grammar[0].id}};
  await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});
  assert.ok(!modalContent.includes('<img'));assert.ok(modalContent.includes('&lt;img'));
});

test('drawing UI keeps per-character pads, reveals comparisons and records only writing',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');const source=defaultState();source.cards=source.cards.filter(c=>[...c.hanzi].length>1);source.settings.sessionSize=1;
 mock.data.set('main',source);await import('../app.js?smoke=drawing04');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('practice-start',{mode:'drawing'});
 let saved=mock.data.get('main'),id=saved.activePractice.current.id,c=saved.cards.find(c=>c.id===id);
 assert.match(mock.shell.innerHTML,/drawing-pad/);assert.ok(!mock.shell.innerHTML.includes(`printed-character">${c.hanzi[0]}`));
 await click('draw-page',{pad:'1'});assert.equal(mock.data.get('main').activePractice.input.pad,1);
 await click('draw-page',{pad:'0'});assert.equal(mock.data.get('main').activePractice.input.pad,0);
 await click('practice-reveal');assert.match(mock.shell.innerHTML,/drawing-comparison/);assert.match(mock.shell.innerHTML,/printed-character/);
 await click('practice-grade',{grade:'3'});saved=mock.data.get('main');
 assert.equal(saved.skillSchedules.drawing[id].reps,1);assert.equal(saved.history.length,0);assert.equal(saved.activePractice,null);
 assert.match(mock.shell.innerHTML,/Protect your progress/);
});

test('particle UI distinguishes a wrong choice from a correct placement and persists score',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');const {PARTICLES}=await import('../particles.js');const s=defaultState();s.settings.sessionSize=1;mock.data.set('main',s);
 await import('../app.js?smoke=particles04');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('practice-start',{mode:'particles'});const id=mock.data.get('main').activePractice.current.id,p=PARTICLES.find(p=>p.id===id),a=p.accepted[0];
 await click('particle-choice',{choice:p.choices.find(c=>c!==a.choice)});await click('particle-slot',{slot:String(a.slot)});await click('practice-check');
 assert.equal(mock.data.get('main').activePractice.input.correct,false);assert.match(mock.shell.innerHTML,/One to revisit/);
 await click('practice-grade',{grade:'4'});assert.equal(mock.data.get('main').skillHistory.length,0);
 await click('practice-grade',{grade:'1'});assert.equal(mock.data.get('main').skillHistory[0].grade,1);assert.equal(mock.data.get('main').skillSchedules.particles[id].score,0);
});

test('tag tree expands branches, selects a parent and excludes its child',async()=>{
 const mock=mockBrowser();await import('../app.js?smoke=tree04');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('navigate',{page:'browse'});
 assert.ok(!mock.browseNodes['#tag-filter'].innerHTML.includes('data-tag="HSK/HSK1"'));
 await click('expand-tag',{kind:'words',tag:'HSK'});assert.match(mock.browseNodes['#tag-filter'].innerHTML,/data-tag="HSK\/HSK1"/);
 await click('cycle-tag',{kind:'words',tag:'HSK'});assert.match(mock.browseNodes['#active-tag-filter'].innerHTML,/include/);
 const before=(mock.browseNodes['#collection-list'].innerHTML.match(/class="list-card"/g)||[]).length;
 await click('cycle-tag',{kind:'words',tag:'HSK/HSK1'});await click('cycle-tag',{kind:'words',tag:'HSK/HSK1'});
 const after=(mock.browseNodes['#collection-list'].innerHTML.match(/class="list-card"/g)||[]).length;assert.ok(after<before);
 await click('reset-tags',{kind:'words'});assert.match(mock.browseNodes['#active-tag-filter'].innerHTML,/No active tags/);
});

test('timing settings save unit controls and update existing due dates',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');const {scheduleReview}=await import('../review-scheduler.js');const s=defaultState(),c=s.cards[0],now=Date.now();s.schedules[c.id]=scheduleReview(null,4,now,s.settings);mock.data.set('main',s);
 await import('../app.js?smoke=timing04');await delay(25);
 const el={dataset:{action:'navigate',page:'settings'}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});assert.match(mock.shell.innerHTML,/Save review timing/);
 const Original=globalThis.FormData;globalThis.FormData=class{get(key){return {scheduler:'score',value0:'5',unit0:'seconds',value1:'10',unit1:'minutes',value2:'3',unit2:'days',value3:'3',unit3:'weeks'}[key];}};
 try{await mock.listeners.submit({target:{matches:q=>q==='#scheduler-form'},preventDefault(){}});await delay();}finally{globalThis.FormData=Original;}
 const saved=mock.data.get('main');assert.equal(saved.settings.retryIntervals[0].unit,'seconds');assert.equal(Date.parse(saved.schedules[c.id].dueAt),now+21*86400000);
});
