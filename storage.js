import {validateReader,resetReaderProgress} from './reader-core.js';
import {APP_VERSION,prepareVersionedBackup} from './backup-versions.js';
import {normalizeTypographySettings} from './fonts.js';
import {validatedTagWeights} from './tag-weights.js';
import {allParticles} from './particles.js';
import {retrySeconds,DEFAULT_RETRY} from './review-scheduler.js';
import {normalizeTags} from './tags.js';
import {ensureStudy} from './study-engine.js';
import {initialCards,extraWords} from './cards.js';
import {initialGrammar,normalizeGrammar} from './grammar.js';
import {hskTagFor} from './hsk-tag-map.js';
// Assign exactly one canonical HSK band based on the headword, regardless of
// which topic deck supplies it. No migration of historical data is needed.
export function canonicalHSKTags(hanzi,tags){
  const cleaned=normalizeTags(tags||[]);
  if(!cleaned.some(t=>/^HSK\//i.test(t))){const level=hskTagFor(hanzi);if(level)cleaned.push('HSK/'+level.toUpperCase());}
  return cleaned;
}
export const DB_NAME='ciyan-mandarin';
const DB_VERSION=1, STORE='state';
let databasePromise;
function database(){
  if(!('indexedDB' in globalThis))return Promise.reject(new Error('IndexedDB is not supported in this browser.'));
  if(!databasePromise)databasePromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Cannot open local database'));
    request.onblocked=()=>reject(new Error('Local database is blocked by another tab'));
  });
  return databasePromise;
}
export function deleteConfirmationValid(value){return String(value??'').trim().toLowerCase()==='delete';}
export function defaultState(){return ensureStudy({
  appVersion:APP_VERSION,schemaVersion:2,cards:[...initialCards(),...extraWords()].map(c=>({...c,tags:canonicalHSKTags(c.hanzi,c.tags)})),grammar:initialGrammar(),schedules:{},history:[],sessions:[],activeSession:null,
  grammarHistory:[],grammarSessions:[],activeGrammarSession:null,
  reader:{},settings:{continuous:true,retryDefaultsVersion:"v0.5",modeSeconds:{},readerGate:"authored",readerHighlight:false,readerCpm:120,sessionSize:12,newWordsPerDay:null,desiredRetention:.90,showPinyinPrompt:false,toneTest:false,enforceTones:false,enabledFonts:['print'],...normalizeTypographySettings({enabledFonts:['print']})},
  revision:0,backedUpRevision:0,lastBackupAt:null,createdAt:new Date().toISOString()
});}
// v0.6.4: content and progress live in the SAME IndexedDB store but in separate
// atomic records. The 12k-card master is written only when it actually changes;
// every study answer still commits its full progress immediately.
const CONTENT_KEY='master-content';
let savedContent=null;
export function cloneProgressState(state,includeContent=false){
 const {reader={},cards,grammar,history,grammarHistory,skillHistory,sessions,grammarSessions,mixedSessions,...progress}=state;
 const copy=structuredClone(progress);
 // Definitions and membership arrays are immutable after import. A review changes only progress.
 copy.reader=Object.fromEntries(Object.entries(reader).map(([id,b])=>[id,{...b,chapters:b.chapters.map(c=>({...c})),progress:{...b.progress},history:b.history.slice()}]));
 // Existing log entries are immutable. Shallow-copy the arrays so push, undo,
 // truncation and deletion cannot mutate the previous committed state.
 for(const [key,array] of Object.entries({history,grammarHistory,skillHistory,sessions,grammarSessions,mixedSessions}))
  copy[key]=Array.isArray(array)?array.slice():[];
 copy.cards=includeContent?structuredClone(cards):cards;
 copy.grammar=includeContent?structuredClone(grammar):grammar;
 return copy;
}
const LOG_FIELDS=['history','grammarHistory','skillHistory'];
const LOG_CHUNK=256;
let savedHistory=null,savedReaderCatalog=new Map();
// A progress write updates only changed 256-record log blocks. Together with
// the separate master-content record, this prevents multi-megabyte writes for
// each answer, while retaining a single IndexedDB transaction for durability.
export async function loadState(){const db=await database();return new Promise((resolve,reject)=>{
 const store=db.transaction(STORE,'readonly').objectStore(STORE),request=store.get('main');
 request.onsuccess=()=>{
  const value=request.result;
  if(!value){savedContent=null;savedHistory=null;resolve(null);return;}
  const contentSplit=!!value.__splitContent,logChunks=value.__historyChunks;
  if(!contentSplit&&!logChunks){savedContent=null;savedHistory=null;resolve(value);return;}
  const restored={...value},logs={};let pending=0,failed=false;
  const fail=error=>{if(!failed){failed=true;reject(error);}};
  const done=()=>{
   if(pending||failed)return;
   if(contentSplit&&(!restored.cards||!restored.grammar)){
    fail(new Error('The local dictionary is missing. Restore your latest full backup; no learning records were cleared.'));return;
   }
   if(logChunks){for(const field of LOG_FIELDS)restored[field]=logs[field].flat();savedHistory=Object.fromEntries(LOG_FIELDS.map(k=>[k,restored[k]]));}
   else savedHistory=null;
   if(contentSplit)savedContent={cards:restored.cards,grammar:restored.grammar};else savedContent=null;
   delete restored.__splitContent;delete restored.__historyChunks;delete restored.__readerCatalog;
   resolve(restored);
  };
  const fetch=(key,callback)=>{
   pending++;const r=store.get(key);
   r.onsuccess=()=>{callback(r.result);pending--;done();};
   r.onerror=()=>fail(r.error||new Error('Unable to read saved progress'));
  };
  // Reserve all pending requests before the first callback runs.
  if(contentSplit)fetch(CONTENT_KEY,result=>{if(result){restored.cards=result.cards;restored.grammar=result.grammar;}});
  savedReaderCatalog=new Map();
  if(value.__readerCatalog)for(const [id,b] of Object.entries(restored.reader)){
   fetch('reader-catalog:'+id,catalog=>{
    if(!catalog||catalog.lists.length!==b.chapters.length){fail(Error('Saved reader catalog is incomplete'));return;}
    b.items=catalog.items;
    b.chapters.forEach((c,i)=>Object.assign(c,catalog.lists[i]));
    savedReaderCatalog.set(id,catalog);
   });
  }
  if(logChunks){for(const field of LOG_FIELDS){
   const count=logChunks[field];
   if(!Number.isSafeInteger(count)||count<0||count>2000){fail(new Error('Invalid saved history chunk index'));return;}
   logs[field]=new Array(count);
   for(let i=0;i<count;i++)fetch(`log:${field}:${i}`,result=>{
    if(!Array.isArray(result)){fail(new Error('Saved review history is incomplete; restore the latest backup.'));return;}
    logs[field][i]=result;
   });
  }}
  done();
 };
 request.onerror=()=>reject(request.error||new Error('Cannot read saved progress'));
});}
export async function saveState(state,expectedRevision=null){const db=await database();return new Promise((resolve,reject)=>{
 const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
 const contentChanged=!savedContent||savedContent.cards!==state.cards||savedContent.grammar!==state.grammar;
 const {cards,grammar,history,grammarHistory,skillHistory,...progress}=state;
 progress.__splitContent=true;
 const catalogs=new Map();
 progress.__readerCatalog=true;
 progress.reader=Object.fromEntries(Object.entries(state.reader||{}).map(([id,b])=>{
  const lists=b.chapters.map(({all,authored})=>({all,authored}));
  catalogs.set(id,{items:b.items,lists});
  return [id,{...b,items:undefined,chapters:b.chapters.map(({all,authored,...meta})=>meta)}];
 }));
 const logs={history,grammarHistory,skillHistory};
 const chunks=Object.fromEntries(LOG_FIELDS.map(field=>[field,Math.ceil((logs[field]||[]).length/LOG_CHUNK)]));
 progress.__historyChunks=chunks;
 let finished=false;
 const fail=e=>{if(finished)return;finished=true;reject(e);};
 const write=()=>{
  for(const [id,catalog] of catalogs){
   const old=savedReaderCatalog.get(id);
   if(old?.items!==catalog.items||old.lists.length!==catalog.lists.length||catalog.lists.some((l,i)=>old.lists[i].all!==l.all||old.lists[i].authored!==l.authored))store.put(catalog,'reader-catalog:'+id);
  }
  for(const id of savedReaderCatalog.keys())if(!catalogs.has(id))store.delete('reader-catalog:'+id);
  if(contentChanged)store.put({cards,grammar},CONTENT_KEY);
  for(const field of LOG_FIELDS){
   const entries=logs[field]||[],prior=savedHistory?.[field],oldCount=Math.ceil((prior?.length||0)/LOG_CHUNK),newCount=chunks[field];
   let shared=0;
   if(prior)while(shared<Math.min(prior.length,entries.length)&&prior[shared]===entries[shared])shared++;
   // A partial last block must be updated if appending; full blocks are shared.
   const start=Math.floor(shared/LOG_CHUNK);
   for(let i=start;i<newCount;i++)store.put(entries.slice(i*LOG_CHUNK,(i+1)*LOG_CHUNK),`log:${field}:${i}`);
   for(let i=newCount;i<oldCount;i++)store.delete(`log:${field}:${i}`);
  }
  store.put(progress,'main');
 };
 if(expectedRevision===null)write();
 else {const read=store.get('main');read.onsuccess=()=>{
  if(read.result&&read.result.revision!==expectedRevision){fail(new Error('Data changed in another tab. Reload before continuing.'));tx.abort();return;}
  write();
 };read.onerror=()=>fail(read.error||new Error('Cannot verify stored revision'));}
 tx.oncomplete=()=>{
  savedContent={cards,grammar};savedHistory=logs;savedReaderCatalog=catalogs;
  if(!finished){finished=true;resolve();}
 };
 tx.onerror=()=>fail(tx.error||new Error('Cannot save progress'));
 tx.onabort=()=>fail(tx.error||new Error('Save was interrupted'));
});}
const string=(x,max)=>String(x??'').trim().slice(0,max);
export function normalizeCard(source,fallbackId=null){
  if(!source||typeof source!=='object')throw new Error('Invalid word card');
  const id=string(source.id||fallbackId||crypto.randomUUID(),120);
  if(id==='prototype'||Object.hasOwn(Object.prototype,id))throw new Error('Reserved card ID');
  const hanzi=string(source.hanzi,120),english=string(source.english,500);
  if(!hanzi||!english)throw new Error('Every word needs Chinese and English');
  const rawTags=Array.isArray(source.tags)?source.tags:String(source.tags||'').split(',');
  const tags=canonicalHSKTags(hanzi,[...new Set(rawTags.map(t=>string(t,160)).filter(Boolean))].slice(0,24));
  // Only the minimal, scored synonym links belong in the master dictionary.
  // Explanations, evidence, and derived rank totals are intentionally omitted.
  let synonyms=[];
  if(source.synonyms!==undefined){
    if(!Array.isArray(source.synonyms)||source.synonyms.length>10000)throw new Error('Invalid synonym list');
    const unique=new Set();
    for(const item of source.synonyms){
      if(!item||typeof item!=='object'||typeof item.id!=='string'||!item.id.trim()||
         !Number.isFinite(item.similarity)||item.similarity<=0||item.similarity>1)
        throw new Error('Invalid synonym relationship');
      const target=item.id.trim().slice(0,120);
      if(target===id||unique.has(target))continue;
      unique.add(target);synonyms.push({id:target,similarity:item.similarity});
    }
    synonyms.sort((a,b)=>b.similarity-a.similarity||a.id.localeCompare(b.id));
  }
  return {id,hanzi,pinyin:string(source.pinyin,160),english,tags,
    source:string(source.source||'My cards',80),createdAt:string(source.createdAt||new Date().toISOString(),80),
    ...(synonyms.length?{synonyms}:{})};
}
function legacySentenceMarkup(sentence,cards){
  const words=[...new Set(cards.map(c=>c.hanzi))].sort((a,b)=>b.length-a.length);
  const src=String(sentence||'');let out='';let i=0;
  while(i<src.length){
    const ch=src[i];
    if(!/\p{Script=Han}/u.test(ch)){out+=ch;i++;continue;}
    let match=words.find(w=>src.startsWith(w,i));
    if(!match)match=ch;
    out+=`{${match}}`;i+=match.length;
  }
  return out;
}
export function migrateState(input){
  if(!input||typeof input!=='object')throw new Error('Stored data is not a Cíyán database');
  if((input.schemaVersion||1)>2)throw new Error('This database needs a newer version of Cíyán');
  if((input.schemaVersion||1)===2){
    const normalizedCards=input.cards.map(c=>{
      const tags=normalizeTags(c.tags||[]);
      return Array.isArray(c.tags)&&tags.length===c.tags.length&&tags.every((tag,i)=>tag===c.tags[i])?c:{...c,tags};
    });
    const same=normalizedCards.every((c,i)=>c===input.cards[i]);
    return ensureStudy({...input,cards:same?input.cards:normalizedCards,grammar:Array.isArray(input.grammar)?input.grammar:[],
      grammarHistory:Array.isArray(input.grammarHistory)?input.grammarHistory:[],
      grammarSessions:Array.isArray(input.grammarSessions)?input.grammarSessions:[],
      activeGrammarSession:input.activeGrammarSession||null,
      settings:{...defaultState().settings,...input.settings,...normalizeTypographySettings(input.settings)}});
  }
  const oldCards=Array.isArray(input.cards)?input.cards:[];
  const migratedCards=oldCards.map(c=>normalizeCard(c));
  // Preserve all existing examples as *independent* grammar entries.
  const examples=oldCards.filter(c=>c.example&&c.exampleEnglish).map(c=>normalizeGrammar({
    id:`legacy-example-${c.id}`,markup:legacySentenceMarkup(c.example,[...migratedCards,...extraWords()]),
    pinyin:c.examplePinyin||'',english:c.exampleEnglish,source:`Example from ${c.hanzi}`,createdAt:c.createdAt
  }));
  for(const extra of extraWords())if(!migratedCards.some(c=>c.hanzi===extra.hanzi))migratedCards.push(extra);
  const grammar=[...examples];
  for(const entry of initialGrammar())if(!grammar.some(g=>g.markup===entry.markup))grammar.push(entry);
  return {...input,schemaVersion:2,cards:migratedCards,grammar,grammarHistory:[],grammarSessions:[],activeGrammarSession:null,
    settings:{...defaultState().settings,sessionSize:input.settings?.sessionSize??12,
      desiredRetention:input.settings?.desiredRetention??.9,showPinyinPrompt:!!input.settings?.showPinyinPrompt},
    revision:(Number(input.revision)||0)+1};
}
const validDate=value=>Number.isFinite(Date.parse(value||''));
export function parseBackup(data){
  if(!data||data.format!=='ciyan-backup'||![1,2].includes(data.version)||!data.state)throw new Error('Not a supported Cíyán backup');
  const checked=prepareVersionedBackup(data);
  const source=migrateState(checked.state),defaults=defaultState();
  if(!Array.isArray(source.cards)||!Array.isArray(source.history)||!Array.isArray(source.sessions)||!Array.isArray(source.grammar))throw new Error('Backup is missing required data');
  if(source.cards.length>20000||source.grammar.length>20000||source.history.length>500000||source.grammarHistory.length>500000)throw new Error('Backup is too large');
  const ids=new Set(),names=new Set();
  const cards=source.cards.map(c=>{const card=normalizeCard(c);if(ids.has(card.id)||names.has(card.hanzi))throw new Error('Duplicate word in backup');ids.add(card.id);names.add(card.hanzi);return card;});
  const grammarIds=new Set();const grammar=source.grammar.map(g=>{const entry=normalizeGrammar(g);if(grammarIds.has(entry.id))throw new Error('Duplicate grammar ID');grammarIds.add(entry.id);return entry;});
  const archived={cards:(source.archived?.cards||[]).map(c=>normalizeCard(c)),grammar:(source.archived?.grammar||[]).map(c=>normalizeGrammar(c))};
  for(const c of archived.cards){if(ids.has(c.id)||names.has(c.hanzi))throw Error('Duplicate archived vocabulary');ids.add(c.id);names.add(c.hanzi);}
  for(const g of archived.grammar){if(grammarIds.has(g.id))throw Error('Duplicate archived grammar');grammarIds.add(g.id);}
  const schedules={};
  for(const [id,s] of Object.entries(source.schedules||{}))if(ids.has(id)&&s&&validDate(s.dueAt)&&validDate(s.lastReviewedAt)){
    if(!Number.isFinite(s.stability)||s.stability<=0||s.stability>36500||!Number.isFinite(s.difficulty)||s.difficulty<1||s.difficulty>10||![1,2,3,4].includes(s.lastRating)||!Number.isSafeInteger(s.reps)||s.reps<1)throw new Error('Invalid memory schedule in backup');
    Object.defineProperty(schedules,id,{value:{...s,reps:s.reps,lapses:Math.max(0,Number(s.lapses)||0)},enumerable:true,writable:true,configurable:true});
  }
  const history=source.history.filter(h=>h&&ids.has(h.cardId)&&[1,2,3,4].includes(h.grade)&&validDate(h.at));
  const sessions=source.sessions.filter(s=>s&&validDate(s.endedAt)).slice(-50000);
  const grammarHistory=source.grammarHistory.filter(h=>h&&grammarIds.has(h.grammarId)&&validDate(h.at)).slice(-500000);
  const grammarSessions=source.grammarSessions.filter(s=>s&&validDate(s.endedAt)).slice(-50000);
  const s=source.settings||{};
  const settings={readerGate:s.readerGate==='auto'?'auto':'authored',readerHighlight:s.readerHighlight===true,readerCpm:Number.isInteger(s.readerCpm)&&s.readerCpm>=10&&s.readerCpm<=1200?s.readerCpm:120,sessionSize:Math.max(1,Math.min(500,Number(s.sessionSize)||12)),
    tagWeights:validatedTagWeights(s.tagWeights),
    newWordsPerDay:s.newWordsPerDay===null||s.newWordsPerDay===undefined||s.newWordsPerDay===''?null:Math.max(0,Math.min(20000,Math.floor(Number(s.newWordsPerDay)||0))),
    desiredRetention:Math.max(.7,Math.min(.97,Number(s.desiredRetention)||.9)),
    continuous:true,retryDefaultsVersion:s.retryDefaultsVersion||'v0.5',autoShares:{...defaults.settings.autoShares,...s.autoShares},scheduler:s.scheduler==='fsrs'?'fsrs':'score',retryIntervals:structuredClone(s.retryIntervals||DEFAULT_RETRY),autoModes:{...defaults.settings.autoModes,...s.autoModes},modeSeconds:s.modeSeconds||{},showPinyinPrompt:!!s.showPinyinPrompt,toneTest:!!s.toneTest,enforceTones:!!s.enforceTones,...normalizeTypographySettings(s)};
  retrySeconds(settings.retryIntervals);
  const activeSession=source.activeSession&&Array.isArray(source.activeSession.queue)&&Array.isArray(source.activeSession.results)
    ?{...source.activeSession,queue:source.activeSession.queue.filter(id=>ids.has(id)),results:source.activeSession.results.filter(r=>ids.has(r.cardId))}:null;
  const activeGrammarSession=source.activeGrammarSession&&Array.isArray(source.activeGrammarSession.queue)&&Array.isArray(source.activeGrammarSession.results)
    ?{...source.activeGrammarSession,queue:source.activeGrammarSession.queue.filter(id=>grammarIds.has(id)),results:source.activeGrammarSession.results.filter(r=>grammarIds.has(r.grammarId))}:null;
  const revision=Math.max(0,Math.floor(Number(source.revision)||0));
  return {...defaults,archived,explicitDictionary:source.explicitDictionary===true,reader:validateReader(source.reader),appVersion:APP_VERSION,cards,grammar,schedules,history,sessions,grammarHistory,grammarSessions,settings,
    postponed:Object.fromEntries(Object.entries(source.postponed||{}).filter(([k,v])=>!Object.hasOwn(Object.prototype,k)&&validDate(v))),skillSchedules:validateSkillSchedules(source.skillSchedules,ids,grammarIds),skillHistory:(source.skillHistory||[]).filter(h=>h&&[1,2,3,4].includes(h.grade)&&validDate(h.at)).slice(-500000),mixedSessions:(source.mixedSessions||[]).filter(s=>validDate(s.endedAt)).slice(-50000),activePractice:validatePractice(source.activePractice,ids,grammarIds,new Set(allParticles({grammar}).map(p=>p.id))),
    activeSession:activeSession?.queue?.length?activeSession:null,
    activeGrammarSession:activeGrammarSession?.queue?.length?activeGrammarSession:null,
    revision,backedUpRevision:revision,lastBackupAt:new Date().toISOString(),createdAt:source.createdAt||defaults.createdAt};
}
export function makeBackup(state){
 const content={...state,appVersion:APP_VERSION,backedUpRevision:state.revision,lastBackupAt:new Date().toISOString()};
 delete content.filters;delete content.studyFilters;
 if(content.activePractice){content.activePractice={...content.activePractice};delete content.activePractice.filters;delete content.activePractice.allowedWords;}
 if(content.lastPracticeUndo){content.lastPracticeUndo=structuredClone(content.lastPracticeUndo);delete content.lastPracticeUndo.filters;delete content.lastPracticeUndo.allowedWords;delete content.lastPracticeUndo.input?.pads;}
 for(const session of [content.activePractice,content.lastPracticeUndo]){if(session?.undo)session.undo=session.undo.map(snap=>{const clean={...snap,input:{...snap.input}};delete clean.input.pads;return clean;});}
 return {format:'ciyan-backup',version:2,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),state:content};
}
export function makeDeck(state){return {format:'ciyan-deck',version:2,records:false,
  cards:state.cards.map(normalizeCardForDeck),grammar:state.grammar.map(g=>({...g}))};}
function normalizeCardForDeck(c){return {...c};}
// Decks are deliberately non-destructive: match by *Chinese text*, not just ID.
export function mergeDeck(current,content){
  if(content?.format && !['ciyan-deck','ciyan-backup'].includes(content.format))throw new Error('Unsupported deck format');
  if(content?.version && ![1,2].includes(content.version))throw new Error('Unsupported deck version');
  const source=Array.isArray(content)?{cards:content}:content?.format==='ciyan-backup'?(content.version===1?migrateState(content.state):content.state):content;
  if(!source||(!Array.isArray(source.cards)&&!Array.isArray(source.grammar)))throw new Error('Expected vocabulary and/or grammar arrays');
  const words=(source.cards||[]).map(c=>normalizeCard(c));
  const grammar=(source.grammar||[]).map(g=>normalizeGrammar(g));
  if(words.length>20000||grammar.length>20000)throw new Error('Deck too large');
  const draft=structuredClone(current);
  const names=new Map(draft.cards.map((c,i)=>[c.hanzi,i]));
  const ids=new Set(draft.cards.map(c=>c.id));
  let addedWords=0,addedGrammar=0,tagsUpdated=0;
  for(const c of words){
    if(names.has(c.hanzi)){
      const existing=draft.cards[names.get(c.hanzi)];
      const tags=canonicalHSKTags(existing.hanzi,[...existing.tags,...c.tags]);
      if(tags.length!==existing.tags.length||tags.some((t,i)=>t!==existing.tags[i])){existing.tags=tags;tagsUpdated++;}
    }else{
      if(ids.has(c.id))c.id=crypto.randomUUID();
      names.set(c.hanzi,draft.cards.length);ids.add(c.id);draft.cards.push(c);addedWords++;
    }
  }
  const sentences=new Set(draft.grammar.map(g=>g.markup));const grammarIds=new Set(draft.grammar.map(g=>g.id));
  for(const g of grammar){
    if(sentences.has(g.markup))continue;
    if(grammarIds.has(g.id))g.id=crypto.randomUUID();
    sentences.add(g.markup);grammarIds.add(g.id);draft.grammar.push(g);addedGrammar++;
  }
  if(draft.cards.length>20000||draft.grammar.length>20000)throw new Error('Combined collection exceeds 20,000 entries');
  return {draft,addedWords,addedGrammar,tagsUpdated};
}
export function clearLearningRecords(d){
  resetReaderProgress(d);d.archived={cards:[],grammar:[]};
  d.lastPracticeUndo=null;d.postponed={};d.skillSchedules={grammar:{},drawing:{},particles:{}};d.skillHistory=[];d.mixedSessions=[];d.activePractice=null;d.schedules={};d.history=[];d.sessions=[];d.activeSession=null;
  d.grammarHistory=[];d.grammarSessions=[];d.activeGrammarSession=null;
}

function validateSkillSchedules(input,words,grammar){
 const out={grammar:{},drawing:{},particles:{}};
 for(const mode of Object.keys(out))for(const [id,s] of Object.entries(input?.[mode]||{})){
  if(Object.hasOwn(Object.prototype,id)||id==='prototype')throw new Error('Invalid skill ID');
  if(mode==='drawing'&&!words.has(id)||mode==='grammar'&&!grammar.has(id))continue;
  if(!s||!validDate(s.dueAt)||!validDate(s.lastReviewedAt)||!Number.isFinite(s.stability)||s.stability<=0||s.stability>36500||!Number.isFinite(s.difficulty)||s.difficulty<1||s.difficulty>10||![1,2,3,4].includes(s.lastRating)||!Number.isSafeInteger(s.reps)||s.reps<1)throw new Error('Invalid skill schedule');
  out[mode][id]={...s};
 }
 return out;
}

function validatePractice(input,words,grammar,particles){
 if(!input)return null;
 const e=input.current;
 if((!e&&!input.continuous)||e&&!['words','grammar','drawing','particles'].includes(e.mode)||!['auto','words','grammar','drawing','particles'].includes(input.mode)||!Array.isArray(input.results)||input.results.length>500000)return null;
 if(e&&e.mode==='particles'&&!particles.has(e.id))return null;
 if(e&&(['words','drawing'].includes(e.mode)&&!words.has(e.id)||e.mode==='grammar'&&!grammar.has(e.id)))return null;
 const result=structuredClone(input);delete result.filters;delete result.allowedWords;result.continuous=true;result.pool=['all','due','new'].includes(result.pool)?result.pool:'all';result.turn=Number.isSafeInteger(result.turn)&&result.turn>=0?result.turn:0;result.deferred=Object.fromEntries(Object.entries(result.deferred||{}).filter(([key,val])=>typeof key==='string'&&val&&Number.isFinite(val.at)&&Number.isSafeInteger(val.turn)));result.limit=Math.max(1,Math.min(500,Number(result.limit)||12));result.spent??={};result.input??={};
 if(result.input.pads){
  if(!Array.isArray(result.input.pads)||result.input.pads.length>120)throw new Error('Invalid drawing pads');
  for(const pad of result.input.pads){if(pad==null)continue;if(!Array.isArray(pad)||pad.length>1000)throw new Error('Invalid drawing strokes');
   for(const stroke of pad)if(!Array.isArray(stroke)||stroke.length>4000||stroke.some(point=>!Array.isArray(point)||point.length!==2||point.some(n=>!Number.isFinite(n)||n<0||n>1)))throw new Error('Invalid drawing coordinates');
  }
 }
 result.undo=[];result.itemStartedAt=Date.now();return result;
}
