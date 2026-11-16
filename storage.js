import {initialCards,extraWords} from './cards.js';
import {initialGrammar,normalizeGrammar} from './grammar.js';
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
export function defaultState(){return {
  schemaVersion:2,cards:[...initialCards(),...extraWords()],grammar:initialGrammar(),schedules:{},history:[],sessions:[],activeSession:null,
  grammarHistory:[],grammarSessions:[],activeGrammarSession:null,
  settings:{sessionSize:12,desiredRetention:.90,showPinyinPrompt:false,toneTest:false,enforceTones:false},
  revision:0,backedUpRevision:0,lastBackupAt:null,createdAt:new Date().toISOString()
};}
export async function loadState(){const db=await database();return new Promise((resolve,reject)=>{
  const r=db.transaction(STORE,'readonly').objectStore(STORE).get('main');
  r.onsuccess=()=>resolve(r.result||null);
  r.onerror=()=>reject(r.error||new Error('Cannot read saved data'));
});}
export async function saveState(state){const db=await database();return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(state,'main');
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Cannot save progress'));
  tx.onabort=()=>reject(tx.error||new Error('Save was interrupted'));
});}
const string=(x,max)=>String(x??'').trim().slice(0,max);
export function normalizeCard(source,fallbackId=null){
  if(!source||typeof source!=='object')throw new Error('Invalid word card');
  const hanzi=string(source.hanzi,120),english=string(source.english,500);
  if(!hanzi||!english)throw new Error('Every word needs Chinese and English');
  const rawTags=Array.isArray(source.tags)?source.tags:String(source.tags||'').split(',');
  const tags=[...new Set(rawTags.map(t=>string(t,36).toLowerCase()).filter(Boolean))].slice(0,24);
  return {id:string(source.id||fallbackId||crypto.randomUUID(),120),hanzi,pinyin:string(source.pinyin,160),english,tags,
    source:string(source.source||'My cards',80),createdAt:string(source.createdAt||new Date().toISOString(),80)};
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
  if((input.schemaVersion||1)>=2){
    return {...input,grammar:Array.isArray(input.grammar)?input.grammar:[],
      grammarHistory:Array.isArray(input.grammarHistory)?input.grammarHistory:[],
      grammarSessions:Array.isArray(input.grammarSessions)?input.grammarSessions:[],
      activeGrammarSession:input.activeGrammarSession||null,
      settings:{...defaultState().settings,...input.settings}};
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
  const source=migrateState(data.state),defaults=defaultState();
  if(!Array.isArray(source.cards)||!Array.isArray(source.history)||!Array.isArray(source.sessions)||!Array.isArray(source.grammar))throw new Error('Backup is missing required data');
  if(source.cards.length>20000||source.grammar.length>20000||source.history.length>500000||source.grammarHistory.length>500000)throw new Error('Backup is too large');
  const ids=new Set(),names=new Set();
  const cards=source.cards.map(c=>{const card=normalizeCard(c);if(ids.has(card.id)||names.has(card.hanzi))throw new Error('Duplicate word in backup');ids.add(card.id);names.add(card.hanzi);return card;});
  const grammarIds=new Set();const grammar=source.grammar.map(g=>{const entry=normalizeGrammar(g);if(grammarIds.has(entry.id))throw new Error('Duplicate grammar ID');grammarIds.add(entry.id);return entry;});
  const schedules={};
  for(const [id,s] of Object.entries(source.schedules||{}))if(ids.has(id)&&s&&validDate(s.dueAt)&&validDate(s.lastReviewedAt)){
    schedules[id]={...s,reps:Math.max(0,Number(s.reps)||0),lapses:Math.max(0,Number(s.lapses)||0)};
  }
  const history=source.history.filter(h=>h&&ids.has(h.cardId)&&[1,2,3,4].includes(h.grade)&&validDate(h.at));
  const sessions=source.sessions.filter(s=>s&&validDate(s.endedAt)).slice(-50000);
  const grammarHistory=source.grammarHistory.filter(h=>h&&grammarIds.has(h.grammarId)&&validDate(h.at)).slice(-500000);
  const grammarSessions=source.grammarSessions.filter(s=>s&&validDate(s.endedAt)).slice(-50000);
  const s=source.settings||{};
  const settings={sessionSize:Math.max(1,Math.min(500,Number(s.sessionSize)||12)),
    desiredRetention:Math.max(.7,Math.min(.97,Number(s.desiredRetention)||.9)),
    showPinyinPrompt:!!s.showPinyinPrompt,toneTest:!!s.toneTest,enforceTones:!!s.enforceTones};
  const activeSession=source.activeSession&&Array.isArray(source.activeSession.queue)&&Array.isArray(source.activeSession.results)
    ?{...source.activeSession,queue:source.activeSession.queue.filter(id=>ids.has(id)),results:source.activeSession.results.filter(r=>ids.has(r.cardId))}:null;
  const activeGrammarSession=source.activeGrammarSession&&Array.isArray(source.activeGrammarSession.queue)&&Array.isArray(source.activeGrammarSession.results)
    ?{...source.activeGrammarSession,queue:source.activeGrammarSession.queue.filter(id=>grammarIds.has(id)),results:source.activeGrammarSession.results.filter(r=>grammarIds.has(r.grammarId))}:null;
  const revision=Math.max(0,Math.floor(Number(source.revision)||0));
  return {...defaults,cards,grammar,schedules,history,sessions,grammarHistory,grammarSessions,settings,
    activeSession:activeSession?.queue?.length?activeSession:null,
    activeGrammarSession:activeGrammarSession?.queue?.length?activeGrammarSession:null,
    revision,backedUpRevision:revision,lastBackupAt:new Date().toISOString(),createdAt:source.createdAt||defaults.createdAt};
}
export function makeBackup(state){return {format:'ciyan-backup',version:2,exportedAt:new Date().toISOString(),
  state:{...state,backedUpRevision:state.revision,lastBackupAt:new Date().toISOString()}};}
export function makeDeck(state){return {format:'ciyan-deck',version:2,records:false,
  cards:state.cards.map(normalizeCardForDeck),grammar:state.grammar.map(g=>({...g}))};}
function normalizeCardForDeck(c){return {...c};}
// Decks are deliberately non-destructive: match by *Chinese text*, not just ID.
export function mergeDeck(current,content){
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
      const tags=[...new Set([...existing.tags,...c.tags])];
      if(tags.length>existing.tags.length){existing.tags=tags;tagsUpdated++;}
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
  return {draft,addedWords,addedGrammar,tagsUpdated};
}
export function clearLearningRecords(d){
  d.schedules={};d.history=[];d.sessions=[];d.activeSession=null;
  d.grammarHistory=[];d.grammarSessions=[];d.activeGrammarSession=null;
}
