// No browser or npm dependencies: runs the app's real UI handlers with a minimal
// IndexedDB + DOM mock. Complements the scheduler tests; not an iOS Safari test.
import test from 'node:test';
import assert from 'node:assert/strict';

const delay = (ms=4) => new Promise(resolve=>setTimeout(resolve,ms));

class MockDatabaseMap extends Map {
 get(key){const value=super.get(key);if(key==='main'&&value?.__splitContent&&!value.cards){
 const content=super.get('master-content'),merged={...value,cards:content?.cards,grammar:content?.grammar};
 if(value.__historyChunks)for(const [field,count] of Object.entries(value.__historyChunks))merged[field]=Array.from({length:count},(_,i)=>super.get(`log:${field}:${i}`)||[]).flat();
 return merged;
 }return value;}
}
const sharedData=new MockDatabaseMap();
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
        put(value,key){data.set(key,structuredClone(value));queueMicrotask(()=>tx.oncomplete?.());},
        delete(key){data.delete(key);queueMicrotask(()=>tx.oncomplete?.());}
      });return tx;
    }
  };
  globalThis.indexedDB={open(){const request={result:fakeDb,onsuccess:null,onerror:null,onupgradeneeded:null};queueMicrotask(()=>request.onsuccess?.());return request;}};
  globalThis.document={
    body,fonts:{},
    querySelector:sel=>sel==='#app'?shell:sel==='#toast'?toast:(browseNodes[sel]||null),
    addEventListener:(type,fn)=>listeners[type]=fn,
    createElement:()=>({className:'',innerHTML:'',remove(){},querySelector:()=>null})
  };
  globalThis.FontFace=class {constructor(family,src){this.family=family;this.src=src;this.status='unloaded';}async load(){this.status='loaded';return this;}};
  Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
  globalThis.window={scrollTo(){},confirm:()=>true};
  globalThis.location={protocol:'file:'};
  return {shell,listeners,data,browseNodes,toast};
}

test('UI renders, reviews persist, session finishes with backup reminder',async()=>{
  const mock=mockBrowser();
  await import('../app.js?smoke=1');
  await delay(25);
  assert.match(mock.shell.innerHTML,/STUDY · YOUR HOME/);assert.doesNotMatch(mock.shell.innerHTML,/data-page="home"/);
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
  assert.match(mock.shell.innerHTML,/continuous/);
  await click('practice-finish');
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
  assert.match(mock.shell.innerHTML,/New vocabulary words per day/);
  await click('navigate',{page:'browse'});
  assert.match(mock.shell.innerHTML,/Every word/);
  await click('navigate',{page:'grammar'});
  assert.match(mock.shell.innerHTML,/Words in/);
});

test('grammar mode unlocks only after required continuous vocabulary scores and records outcomes',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');const {replaceMaster}=await import('../master.js');const {MASTER}=await import('../master-data.js');const {scheduleReview}=await import('../review-scheduler.js');
 const s=defaultState();replaceMaster(s,MASTER);for(const c of s.cards)s.schedules[c.id]={...scheduleReview(null,3,Date.now(),s.settings),score:2.5};mock.data.set('main',s);
 await import('../app.js?smoke=grammar');await delay(25);
 assert.match(mock.shell.innerHTML,/Available to study/);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('practice-start',{mode:'grammar'});assert.match(mock.shell.innerHTML,/Grammar ·/);
 const g=mock.data.get('main').grammar.find(g=>g.id===mock.data.get('main').activePractice.current.id);
 const {grammarTokens}=await import('../grammar.js');
 for(let i=0;i<grammarTokens(g).length;i++)await click('practice-pick',{tile:`t${i}`});
 await click('practice-check');assert.match(mock.shell.innerHTML,/Correct target order/);
 await click('practice-grade',{grade:'3'});assert.equal(mock.data.get('main').grammarHistory[0].correct,true);
 assert.equal(mock.data.get('main').activePractice.results.length,1);
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


test('bundled master is available without importing; filters and focused study work',async()=>{
 const mock=mockBrowser();await import('../app.js?smoke=master041');await delay(25);
 assert.match(mock.shell.innerHTML,/STUDY · YOUR HOME/);assert.doesNotMatch(mock.shell.innerHTML,/Explore optional decks/);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('navigate',{page:'browse'});assert.equal(parseInt(mock.browseNodes['#browse-count'].textContent),11893);
 assert.equal((mock.browseNodes['#collection-list'].innerHTML.match(/class="list-card"/g)||[]).length,20);
 await click('cycle-tag',{kind:'words',tag:'Activities/climbing'});await click('study-filtered');
 const saved=mock.data.get('main');assert.ok(saved.activePractice.allowedWords.every(id=>saved.cards.find(c=>c.id===id).tags.includes('Activities/climbing')));
 assert.match(mock.shell.innerHTML,/Undo last answer/);
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

test('refresh retains custom grammar safely and escapes malicious HTML',async()=>{
  const mock=mockBrowser();const {defaultState}=await import('../storage.js');const source=defaultState();
  source.grammar[0].distractors=[{index:1,word:'<img src=x onerror=alert(1)>'}];mock.data.set('main',source);
  let modalContent='';document.body.append=node=>{modalContent=node.innerHTML;};
  await import('../app.js?smoke=escape');await delay(25);
  const el={dataset:{action:'grammar-detail',id:source.grammar[0].id}};
  await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});
  assert.ok(!modalContent.includes('<img'));assert.ok(modalContent.includes('&lt;img')); // escaped, not executed
});

test('drawing UI requires score >=2, navigates pads and records independent writing',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');const {replaceMaster}=await import('../master.js');const {MASTER}=await import('../master-data.js');const {scheduleReview}=await import('../review-scheduler.js');
 const s=defaultState();replaceMaster(s,MASTER);const c=s.cards.find(x=>x.hanzi==='随便');s.schedules[c.id]={...scheduleReview(null,3,Date.now(),s.settings),score:2.5};mock.data.set('main',s);
 await import('../app.js?smoke=drawing04');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('practice-start',{mode:'drawing'});const saved=mock.data.get('main'),id=saved.activePractice.current.id;
 assert.equal(id,c.id);assert.match(mock.shell.innerHTML,/drawing-pad/);
 await click('draw-page',{pad:'1'});assert.equal(mock.data.get('main').activePractice.input.pad,1);
 await click('draw-page',{pad:'0'});assert.equal(mock.data.get('main').activePractice.input.pad,0);
 await click('practice-reveal');assert.match(mock.shell.innerHTML,/drawing-comparison/);assert.match(mock.shell.innerHTML,/data-rating="easy"/);assert.match(mock.shell.innerHTML,/Grade each character/);
 assert.equal((mock.shell.innerHTML.match(/class="drawing-grade-row"/g)||[]).length,2);
 assert.doesNotMatch(mock.shell.innerHTML,/data-action="practice-grade"/);
 await click('draw-feedback',{index:'0',rating:'forgotten'});assert.equal(mock.data.get('main').activePractice.input.characterRatings[0],'forgotten');
 assert.equal(mock.data.get('main').skillHistory.length,0);assert.match(mock.shell.innerHTML,/unselected/);
 await click('draw-feedback',{index:'1',rating:'easy'});
 const done=mock.data.get('main');assert.equal(done.skillSchedules.drawing[id].reps,1);assert.equal(done.skillHistory[0].grade,1);assert.deepEqual(done.skillHistory[0].characters,[{character:'随',rating:'forgotten',grade:1},{character:'便',rating:'easy',grade:4}]);assert.equal(done.lastPracticeUndo.undo[0].input.pads,undefined);assert.equal(done.history.length,0);
 assert.equal(done.activePractice,null);assert.match(mock.shell.innerHTML,/Protect your progress/);
});

test('Particle Zoo requires familiar base and choices, grades wrong choice separately from placement',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');const {replaceMaster}=await import('../master.js');const {MASTER}=await import('../master-data.js');const {scheduleReview}=await import('../review-scheduler.js');const {PARTICLES}=await import('../particles.js');
 const s=defaultState();replaceMaster(s,MASTER);for(const word of new Set([...PARTICLES[0].base,...PARTICLES[0].choices])){const c=s.cards.find(x=>x.hanzi===word);s.schedules[c.id]={...scheduleReview(null,3,Date.now(),s.settings),score:2.5};}mock.data.set('main',s);
 await import('../app.js?smoke=particles04');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('practice-start',{mode:'particles'});const id=mock.data.get('main').activePractice.current.id,p=PARTICLES.find(x=>x.id===id),a=p.accepted[0];
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
 const before=parseInt(mock.browseNodes['#browse-count'].textContent);
 await click('cycle-tag',{kind:'words',tag:'HSK/HSK1'});await click('cycle-tag',{kind:'words',tag:'HSK/HSK1'});
 const after=parseInt(mock.browseNodes['#browse-count'].textContent);assert.ok(after<before);
 await click('reset-tags',{kind:'words'});assert.match(mock.browseNodes['#active-tag-filter'].innerHTML,/No active tags/);
});

test('timing settings save unit controls and update existing due dates',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');const {scheduleReview}=await import('../review-scheduler.js');const s=defaultState(),c=s.cards[0],now=Date.now();s.schedules[c.id]={...scheduleReview(null,4,now,s.settings),score:3};mock.data.set('main',s);
 await import('../app.js?smoke=timing04');await delay(25);
 const el={dataset:{action:'navigate',page:'settings'}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});assert.match(mock.shell.innerHTML,/Preview scheduling changes/);
 const Original=globalThis.FormData;globalThis.FormData=class{get(key){return {scheduler:'score',value0:'5',unit0:'seconds',value1:'10',unit1:'minutes',value2:'3',unit2:'days',value3:'3',unit3:'weeks'}[key];}};
 try{await mock.listeners.submit({target:{matches:q=>q==='#scheduler-form'},preventDefault(){}});await delay();}finally{globalThis.FormData=Original;}
 assert.equal(mock.data.get('main').settings.retryIntervals[0].unit,'minutes');
 const apply={dataset:{action:'apply-timing',scope:'existing'}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?apply:null}});await delay();
 const saved=mock.data.get('main');assert.equal(saved.settings.retryIntervals[0].unit,'seconds');assert.equal(Date.parse(saved.schedules[c.id].dueAt),now+21*86400000);
});

test('vocabulary reveal includes context and undo after completion reverses the stored answer',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');const s=defaultState();s.settings.sessionSize=1;s.settings.newWordsPerDay=1;mock.data.set('main',s);
 await import('../app.js?smoke=undo041');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('start',{mode:'words'});const id=mock.data.get('main').activePractice.current.id;
 await click('practice-reveal');assert.match(mock.shell.innerHTML,/review-english/);assert.match(mock.shell.innerHTML,/36\.3m/);assert.match(mock.shell.innerHTML,/Score 0\.36/);
 await click('practice-grade',{grade:'3'});assert.equal(mock.data.get('main').history.length,1);assert.match(mock.shell.innerHTML,/undo-completed/);
 await click('undo-completed');const restored=mock.data.get('main');assert.equal(restored.history.length,0);assert.equal(restored.schedules[id],undefined);assert.equal(restored.mixedSessions.length,0);assert.equal(restored.activePractice.current.id,id);
});
test('skip and explicit postpone controls do not add failed answers',async()=>{
 const mock=mockBrowser();await import('../app.js?smoke=skip041');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('start');const first=mock.data.get('main').activePractice.current.id;await click('practice-skip');let s=mock.data.get('main');assert.notEqual(s.activePractice.current.id,first);assert.equal(s.history.length,0);assert.equal(s.activePractice.results.length,0);
 const second=s.activePractice.current.id;await click('practice-postpone');s=mock.data.get('main');assert.ok(s.activePractice.deferred['words:'+second]);assert.equal(s.history.length,0);assert.notEqual(s.activePractice.current.id,second);
});
test('future-only timing changes require confirmation and leave existing due dates alone',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');const {scheduleReview}=await import('../review-scheduler.js');const s=defaultState(),id=s.cards[0].id;s.schedules[id]=scheduleReview(null,3,Date.now(),s.settings);const before=s.schedules[id].dueAt;mock.data.set('main',s);
 await import('../app.js?smoke=future041');await delay(25);let modalContent='';document.body.append=node=>modalContent=node.innerHTML;
 const Original=globalThis.FormData;globalThis.FormData=class{get(key){return {scheduler:'score',value0:'5',unit0:'seconds',value1:'10',unit1:'minutes',value2:'3',unit2:'days',value3:'3',unit3:'weeks'}[key];}};
 try{await mock.listeners.submit({target:{matches:q=>q==='#scheduler-form'},preventDefault(){}});await delay();}finally{globalThis.FormData=Original;}
 assert.match(modalContent,/additional reviews due now/);assert.equal(mock.data.get('main').settings.retryIntervals[0].unit,'minutes');
 const el={dataset:{action:'apply-timing',scope:'future'}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();assert.equal(mock.data.get('main').settings.retryIntervals[0].unit,'seconds');assert.equal(mock.data.get('main').schedules[id].dueAt,before);
});

test('v0.5 Study landing filters and due/new/all pool are session-specific',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');const {scheduleReview}=await import('../review-scheduler.js');
 const s=defaultState();const c=s.cards[0];s.schedules[c.id]={...scheduleReview(null,3,Date.now()-86400000,s.settings),score:2,dueAt:new Date(Date.now()-1000).toISOString()};mock.data.set('main',s);
 await import('../app.js?smoke=pool05');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay(5);};
 assert.doesNotMatch(mock.shell.innerHTML,/data-page="home"/);assert.match(mock.shell.innerHTML,/Session filters/);assert.match(mock.shell.innerHTML,/Due only/);
 await click('study-pool',{pool:'due'});await click('practice-start',{mode:'words'});
 let saved=mock.data.get('main');assert.equal(saved.activePractice.current.id,c.id);assert.equal(saved.activePractice.pool,'due');
 await click('practice-finish');await click('study-pool',{pool:'new'});await click('practice-start',{mode:'words'});
 saved=mock.data.get('main');assert.ok(saved.activePractice.current.id!==c.id);assert.equal(saved.activePractice.pool,'new');
 await click('practice-finish');await click('navigate',{page:'stats'});assert.match(mock.shell.innerHTML,/Vocabulary due now/);assert.match(mock.shell.innerHTML,/Words encountered/);
});

test('v0.5 session tag tree chooses matching word pool without saving filters into full backup',async()=>{
 const mock=mockBrowser();await import('../app.js?smoke=studyfilter05');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay(5);};
 await click('study-expand-tag',{tag:'Food'});await click('study-tag',{tag:'Food'});
 assert.match(mock.shell.innerHTML,/Food/);
 await click('practice-start',{mode:'words'});
 const s=mock.data.get('main'),id=s.activePractice.current.id;
 assert.ok(s.cards.find(c=>c.id===id).tags.some(t=>t==='Food'||t.startsWith('Food/')));
 const {makeBackup}=await import('../storage.js');assert.equal(makeBackup(s).state.activePractice.filters,undefined);
});

test('v0.5 settings persist a zero daily word cap but default blank is unlimited',async()=>{
 const mock=mockBrowser();await import('../app.js?smoke=cap05');await delay(25);
 const change=async value=>{await mock.listeners.change({target:{dataset:{setting:'newWordsPerDay'},type:'number',value}});await delay(5);};
 await change('0');assert.equal(mock.data.get('main').settings.newWordsPerDay,0);
 await change('35');assert.equal(mock.data.get('main').settings.newWordsPerDay,35);
 await change('');assert.equal(mock.data.get('main').settings.newWordsPerDay,null);
});

test('v0.5.1 tag-weight settings apply only on submit, show exact odds, and persist in full backup',async()=>{
 const mock=mockBrowser();await import('../app.js?smoke=weights051');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('navigate',{page:'settings'});
 assert.match(mock.shell.innerHTML,/New vocabulary · tag weights/);
 assert.match(mock.shell.innerHTML,/New-card odds/);
 assert.match(mock.shell.innerHTML,/Apply tag weights &amp; recalculate odds/);
 const snapshot=mock.shell.innerHTML;
 // Editing a field does not recompute percentages or write data before Apply.
 await mock.listeners.input({target:{id:'',dataset:{tagWeight:'HSK/HSK1'},value:'25',closest:()=>null}});
 assert.equal(mock.shell.innerHTML,snapshot);
 const form={matches:q=>q==='#tag-weight-form',querySelectorAll:q=>q==='[data-tag-weight]'?[
  {dataset:{tagWeight:'HSK/HSK1'},value:'25'},
  {dataset:{tagWeight:'Food/food'},value:'2'}]:[]};
 await mock.listeners.submit({target:form,preventDefault(){}});await delay();
 const state=mock.data.get('main');assert.equal(state.settings.tagWeights['HSK/HSK1'],25);assert.equal(state.settings.tagWeights['Food/food'],2);
 assert.notEqual(mock.shell.innerHTML,snapshot);
 const {makeBackup}=await import('../storage.js');assert.equal(makeBackup(state).state.settings.tagWeights['HSK/HSK1'],25);
});

test('v0.5.1 Settings odds reflect a newly introduced word when returning to Settings',async()=>{
 const mock=mockBrowser();await import('../app.js?smoke=odds051');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('navigate',{page:'settings'});assert.match(mock.shell.innerHTML,/11893 unstudied words/);
 await click('navigate',{page:'study'});await click('practice-start',{mode:'words'});await click('practice-reveal');await click('practice-grade',{grade:'3'});
 await click('practice-finish');await click('navigate',{page:'settings'});
 assert.match(mock.shell.innerHTML,/11892 unstudied words/);
});

test('v0.5.3 current state does not automatically rewrite old retry settings or review dates',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');const {scheduleReview}=await import('../review-scheduler.js');
 const state=defaultState();state.settings.retryIntervals=[{value:10,unit:'minutes'},{value:6,unit:'hours'},{value:2,unit:'days'},{value:2,unit:'weeks'}];state.settings.retryDefaultsVersion='v0.5';
 const card=state.cards[0],schedule=scheduleReview(null,3,Date.now(),state.settings);state.schedules[card.id]=schedule;mock.data.set('main',state);
 await import('../app.js?smoke=noImplicitMigration053');await delay(25);
 const after=mock.data.get('main');assert.equal(after.settings.retryIntervals[2].value,2);assert.equal(after.settings.retryDefaultsVersion,'v0.5');assert.equal(after.schedules[card.id].dueAt,schedule.dueAt);
});

test('v0.5.2 Study landing displays daily-capped vocabulary counts, not the master total',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');
 const s=defaultState();s.settings.newWordsPerDay=5;mock.data.set('main',s);
 await import('../app.js?smoke=counts052');await delay(25);
 assert.match(mock.shell.innerHTML,/<strong>5<\/strong><small>Available to study<\/small>/);
 assert.match(mock.shell.innerHTML,/5 new available of 11893 unstarted matching words/);
 assert.match(mock.shell.innerHTML,/5 new available across enabled modes/);
 assert.doesNotMatch(mock.shell.innerHTML,/>11893<\/strong><small>Available to study/);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('study-pool',{pool:'due'});
 assert.match(mock.shell.innerHTML,/<strong>0<\/strong><small>Available to study<\/small>/);
 await click('study-pool',{pool:'new'});
 assert.match(mock.shell.innerHTML,/<strong>5<\/strong><small>Available to study<\/small>/);
});

test('v0.5.2 Settings accepts negative and fractional tag weights and applies odds on submit',async()=>{
 const mock=mockBrowser();await import('../app.js?smoke=negative052');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('navigate',{page:'settings'});
 assert.match(mock.shell.innerHTML,/zero is neutral/);
 assert.match(mock.shell.innerHTML,/New tags start at weight 0/);
 assert.match(mock.shell.innerHTML,/type="number" step="any" value="0"/);
 const form={matches:q=>q==='#tag-weight-form',querySelectorAll:q=>q==='[data-tag-weight]'?[
   {dataset:{tagWeight:'Food/food'},value:'-1.75'},
   {dataset:{tagWeight:'HSK/HSK1'},value:'0.125'}]:[]};
 await mock.listeners.submit({target:form,preventDefault(){}});await delay();
 const state=mock.data.get('main');assert.equal(state.settings.tagWeights['Food/food'],-1.75);
 assert.equal(state.settings.tagWeights['HSK/HSK1'],.125);
 const {makeBackup}=await import('../storage.js');assert.equal(makeBackup(state).state.settings.tagWeights['Food/food'],-1.75);
});

test('v0.5.4 preserves all local results and preferences when upgrading from v0.5.3',async()=>{
 const mock=mockBrowser();
 const {defaultState}=await import('../storage.js');
 const {scheduleReview}=await import('../review-scheduler.js');
 const old=defaultState();old.appVersion='0.5.3';old.revision=7;
 const card=old.cards[0];old.settings.tagWeights['HSK/HSK1']=7;
 old.settings.newWordsPerDay=5;old.settings.retryIntervals[2]={value:2.5,unit:'days'};
 const reviewedAt=Date.now()-86400000;
 old.schedules[card.id]=scheduleReview(null,3,reviewedAt,old.settings);
 old.history=[{id:'old',cardId:card.id,grade:3,at:new Date(reviewedAt).toISOString()}];
 old.skillHistory=[{id:'written',mode:'drawing',grade:3,at:new Date(reviewedAt).toISOString()}];
 old.grammarHistory=[{id:'grammar-review',grammarId:old.grammar[0].id,grade:3,correct:true,at:new Date(reviewedAt).toISOString()}];
 const before=structuredClone(old);mock.data.set('main',structuredClone(old));
 await import('../app.js?smoke=preserveUpgrade054');await delay(40);
 // Upgrading may do one atomic content reconciliation, but must not touch
 // old learning scores, history, user settings, custom IDs or definitions.
 const reconciled=mock.data.get('main');
 assert.equal(reconciled.bundledMasterVersion,'0.6.6');
 assert.deepEqual(reconciled.history,before.history);
 assert.deepEqual(reconciled.grammarHistory,before.grammarHistory);
 assert.deepEqual(reconciled.skillHistory,before.skillHistory);
 assert.deepEqual(reconciled.schedules,before.schedules);
 assert.equal(reconciled.settings.newWordsPerDay,before.settings.newWordsPerDay);
 assert.ok(reconciled.cards.length>=before.cards.length);
 assert.ok(reconciled.grammar.length>=before.grammar.length);
 assert.match(mock.shell.innerHTML,/5 new available/);
 const navigate={dataset:{action:'navigate',page:'settings'}};
 await mock.listeners.click({target:{closest:q=>q==='[data-action]'?navigate:null}});await delay();
 assert.match(mock.shell.innerHTML,/New vocabulary words per day/);
 assert.deepEqual(mock.data.get('main'),reconciled);
 // A normal user edit should then stamp the current version and retain progress.
 const target={type:'number',value:'3',dataset:{setting:'newWordsPerDay'}};
 await mock.listeners.change({target});await delay();
 const saved=mock.data.get('main');
 assert.equal(saved.appVersion,'0.6.6');assert.equal(saved.settings.newWordsPerDay,3);
 assert.equal(saved.settings.tagWeights['HSK/HSK1'],7);
 assert.deepEqual(saved.settings.retryIntervals[2],before.settings.retryIntervals[2]);
 assert.deepEqual(saved.schedules,before.schedules);
 assert.deepEqual(saved.history,before.history);assert.deepEqual(saved.skillHistory,before.skillHistory);
 assert.deepEqual(saved.grammarHistory,before.grammarHistory);
 assert.equal(saved.revision,reconciled.revision+1);
 // Reload at the new version also preserves everything.
 await import('../app.js?smoke=preserveRefresh054');await delay(40);
 const reloaded=mock.data.get('main');assert.deepEqual(reloaded,saved);
});

test('v0.5.4 creates clean defaults only when no saved state exists',async()=>{
 const mock=mockBrowser();await import('../app.js?smoke=newInstallation054');await delay(35);
 const saved=mock.data.get('main');assert.equal(saved.appVersion,'0.6.6');
 assert.equal(saved.cards.length,11893);assert.equal(saved.grammar.length,3444);
 assert.equal(saved.history.length,0);
});

test('v0.5.5 word details show scored synonyms after context and navigate with a working back trail',async()=>{
 const mock=mockBrowser();const dialogs=[];document.body.append=node=>dialogs.push(node.innerHTML);
 await import('../app.js?smoke=synonyms055');await delay(25);
 const saved=mock.data.get('main');const tomato=saved.cards.find(c=>c.hanzi==='番茄'),other=saved.cards.find(c=>c.hanzi==='西红柿');
 assert.ok(tomato&&other&&tomato.synonyms.some(x=>x.id===other.id));
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('card-detail',{id:tomato.id});
 let view=dialogs.at(-1);assert.match(view,/In context/);assert.match(view,/Original tokens:/);assert.match(view,/Exact token/);assert.match(view,/Synonyms ·/);assert.ok(view.indexOf('In context')<view.indexOf('Synonyms ·'));
 assert.match(view,/data-action="synonym-detail"/);assert.match(view,/0\.99/);assert.doesNotMatch(view,/shared_sense|evidence|confidence_band/);
 await click('synonym-detail',{id:other.id});view=dialogs.at(-1);assert.match(view,/Back to 番茄/);assert.match(view,/西红柿/);
 await click('synonym-back');view=dialogs.at(-1);assert.match(view,/番茄/);assert.doesNotMatch(view,/data-action="synonym-back"/);
});

test('v0.6 omission answer checks without choosing a gap and saves error classification',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');const s=defaultState();
 s.activePractice={id:'omit-ui',mode:'particles',continuous:true,pool:'all',startedAt:new Date().toISOString(),itemStartedAt:Date.now(),spent:{},results:[],input:{},skipped:[],deferred:{},turn:0,undo:[],current:{id:'particle-v06-le-havent-eaten',mode:'particles',family:'了'}};mock.data.set('main',s);
 await import('../app.js?smoke=omit060');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 assert.match(mock.shell.innerHTML,/No particle/);await click('particle-choice',{choice:'∅'});await click('practice-check');assert.equal(mock.data.get('main').activePractice.input.correct,true);
 await click('practice-grade',{grade:'3'});assert.equal(mock.data.get('main').skillHistory[0].correct,true);assert.equal(mock.data.get('main').skillHistory[0].errorType,null);
});

test('v0.6.4 pagination shows 20 rows, navigates in both collections, and resets on search',async()=>{
 const mock=mockBrowser();await import('../app.js?smoke=paging064');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay(4);};
 await click('navigate',{page:'browse'});
 const count=()=> (mock.browseNodes['#collection-list'].innerHTML.match(/class="list-card(?: grammar-list)?"/g)||[]).length;
 assert.equal(count(),20);assert.match(mock.browseNodes['#collection-list'].innerHTML,/Page <strong>1<\/strong>/);
 const first=mock.browseNodes['#collection-list'].innerHTML.match(/data-id="([^"]+)"/)?.[1];
 await click('collection-page',{kind:'words',dir:'next'});
 assert.equal(count(),20);assert.match(mock.browseNodes['#collection-list'].innerHTML,/Page <strong>2<\/strong>/);
 assert.notEqual(mock.browseNodes['#collection-list'].innerHTML.match(/data-id="([^"]+)"/)?.[1],first);
 await click('collection-page',{kind:'words',dir:'last'});assert.match(mock.browseNodes['#collection-list'].innerHTML,/Page <strong>595<\/strong>/);
 mock.listeners.input({target:{id:'collection-search',value:'米饭'}});
 assert.equal(count(),1);assert.match(mock.browseNodes['#collection-list'].innerHTML,/Page <strong>1<\/strong>/);
 await click('navigate',{page:'grammar'});assert.equal(count(),20);
 await click('collection-page',{kind:'grammar',dir:'next'});assert.equal(count(),20);
 assert.match(mock.browseNodes['#collection-list'].innerHTML,/Page <strong>2<\/strong>/);
});

test('v0.6.5 puts session filters after study controls and restores readable settings',async()=>{
 const mock=mockBrowser();await import('../app.js?smoke=065-home');await delay(25);
 const html=mock.shell.innerHTML;
 assert.ok(html.indexOf('Session filters')>html.indexOf('Auto Study'));
 assert.ok(html.indexOf('Session filters')>html.indexOf('Study particle zoo'));
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('navigate',{page:'settings'});
 assert.match(mock.shell.innerHTML,/Chinese typography/);
 assert.match(mock.shell.innerHTML,/data-setting="fontDifficulty"/);
 assert.match(mock.shell.innerHTML,/data-setting="fontChoice"/);
 assert.match(mock.shell.innerHTML,/file-action-icon/);
 assert.equal((mock.shell.innerHTML.match(/class="file-action-icon"/g)||[]).length,4);
 const change=async(key,value)=>{
  await mock.listeners.change({target:{dataset:{setting:key},type:'select-one',value,closest:()=>null}});await delay();
 };
 await change('fontDifficulty','advanced');
 assert.equal(mock.data.get('main').settings.fontDifficulty,'advanced');
 assert.equal(mock.data.get('main').settings.fontChoice,'zhushi');
 await change('fontChoice','mixed');
 assert.equal(mock.data.get('main').settings.fontChoice,'mixed');
 await click('navigate',{page:'study'});
 assert.match(mock.shell.innerHTML,/Session filters/);
});

test('single-character drawing completes on one rating, without a second word grade',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');
 const {replaceMaster}=await import('../master.js');const {MASTER}=await import('../master-data.js');
 const {scheduleReview}=await import('../review-scheduler.js');
 const s=defaultState();replaceMaster(s,MASTER);
 const c=s.cards.find(c=>c.hanzi==='我');assert.ok(c);
 s.schedules[c.id]={...scheduleReview(null,3,Date.now(),s.settings),score:2.5};mock.data.set('main',s);
 await import('../app.js?smoke=065-single');await delay(25);
 const click=async(action,extra={})=>{const el={dataset:{action,...extra}};await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();};
 await click('practice-start',{mode:'drawing'});
 assert.equal(mock.data.get('main').activePractice.current.id,c.id);
 await click('practice-reveal');assert.match(mock.shell.innerHTML,/Grade each character/);
 assert.equal((mock.shell.innerHTML.match(/class="drawing-grade-row"/g)||[]).length,1);
 await click('draw-feedback',{index:'0',rating:'easy'});
 const d=mock.data.get('main');assert.equal(d.activePractice,null);
 assert.equal(d.skillHistory.length,1);assert.equal(d.skillHistory[0].grade,4);
 assert.deepEqual(d.skillHistory[0].characters,[{character:'我',rating:'easy',grade:4}]);
 assert.equal(d.skillSchedules.drawing[c.id].reps,1);
});

test('particle error stats render two readable lines instead of narrow grid columns',async()=>{
 const mock=mockBrowser();const {defaultState}=await import('../storage.js');
 const {PARTICLES}=await import('../particles.js');
 const s=defaultState();s.skillHistory=[{id:PARTICLES[0].id,mode:'particles',correct:false,grade:1,at:'2026-11-18T10:00:00.000Z'}];mock.data.set('main',s);
 await import('../app.js?smoke=065-pstats');await delay(25);
 const el={dataset:{action:'navigate',page:'stats'}};
 await mock.listeners.click({target:{closest:q=>q==='[data-action]'?el:null}});await delay();
 assert.match(mock.shell.innerHTML,/Particles to revisit/);
 assert.match(mock.shell.innerHTML,/class="particle-issue"/);
 assert.match(mock.shell.innerHTML,/1 incorrect · 1 attempts/);
});

test('v0.6.6 refuses a missing installed font and retains the last working preference, including Mixed',async()=>{
 const mock=mockBrowser();
 const {clearFontProbeCache}=await import('../fonts.js');
 clearFontProbeCache();
 const dialogs=[];document.body.append=node=>dialogs.push(node.innerHTML);
 globalThis.FontFace=class {
  constructor(family,src){this.family=family;this.src=src;this.status='unloaded';}
  async load(){if(this.src.includes('Zhi Mang Xing'))throw new Error('No local font');this.status='loaded';return this;}
 };
 await import('../app.js?smoke=fontrollback066');await delay(30);
 const change=async(setting,value)=>{
  await mock.listeners.change({target:{dataset:{setting},type:'select-one',value,closest:()=>null}});await delay(10);
 };
 await change('fontDifficulty','expert');
 assert.equal(mock.data.get('main').settings.fontDifficulty,'expert');
 assert.equal(mock.data.get('main').settings.fontChoice,'muyao');
 const revision=mock.data.get('main').revision;
 await change('fontChoice','zhimang');
 assert.equal(mock.data.get('main').settings.fontChoice,'muyao');
 assert.equal(mock.data.get('main').revision,revision);
 assert.ok(dialogs.some(text=>text.includes('Font unavailable')));
 await change('fontChoice','mixed');
 assert.equal(mock.data.get('main').settings.fontChoice,'muyao');
 assert.equal(mock.data.get('main').revision,revision);
 clearFontProbeCache();
});
