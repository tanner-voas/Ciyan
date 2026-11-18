/* Cíyán v0.6.7.dev2: fetch web-font sources on demand; store validated
   bytes in independent IndexedDB for offline use. Also allow Files imports.
   The browser cannot use iOS configuration-profile font registrations. */
import {FONT_CATALOG} from './fonts.js';
import {FONT_REMOTE_SOURCES} from './font-sources.js';

const DATABASE='ciyan-user-fonts';
const STORE='files';
const MAX_BYTES=30*1024*1024;
const VALID_EXT=/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/;
const CJK='假如生活欺骗了你中文汉字书写';
const imported=new Map();
const checked=new Map();
const downloads=new Map();
const urlById=new Map();
let dbPromise=null;
let initialized=false;
let lastError=null;

function openDB(env=globalThis){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  if(!env.indexedDB){reject(new Error('IndexedDB is not available; custom font files cannot persist.'));return;}
  const req=env.indexedDB.open(DATABASE,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||new Error('Font library could not be opened.'));
  req.onblocked=()=>reject(new Error('Font library is blocked by another tab. Close other Cíyán windows.'));
 }).catch(error=>{dbPromise=null;throw error;});
 return dbPromise;
}
async function readRecords(env){const db=await openDB(env);return new Promise((resolve,reject)=>{
 const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).getAll();
 req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error||new Error('Unable to read saved fonts.'));
 tx.onerror=()=>reject(tx.error||new Error('Font read transaction failed.'));
});}
async function putRecord(record,env){const db=await openDB(env);return new Promise((resolve,reject)=>{
 const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(record);
 tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Font storage quota exceeded.'));
 tx.onabort=()=>reject(tx.error||new Error('Font write was aborted.'));
});}
async function removeRecord(id,env){const db=await openDB(env);return new Promise((resolve,reject)=>{
 const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);
 tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Font removal failed.'));
});}
export function getImportedFonts(){return Object.fromEntries([...imported].map(([id,r])=>[id,{name:r.name,size:r.size,importedAt:r.importedAt,source:r.source||'upload'}]));}
export function importedFontIds(){return [...imported.keys()];}
export function fontLibraryError(){return lastError;}
function webFontFormat(name){const ext=name.split('.').at(-1).toLowerCase();return {ttf:'truetype',otf:'opentype',woff:'woff',woff2:'woff2'}[ext]||'truetype';}
function fileBytes(record){return record.bytes instanceof ArrayBuffer?record.bytes:record.bytes?.buffer||record.bytes;}
function fontFaceName(id){return FONT_CATALOG[id]?.face;}
// Register just the six individual web-font faces; Unicode-range based
// character mixing cannot vary repeated copies of the same character.
export function compileImportedFontCSS(_unusedTemplate,files){
 return Object.entries(FONT_CATALOG).flatMap(([id,{face}])=>{
  const file=files.get(id);if(!file?.url)return [];
  const safe=file.url.replaceAll('"','%22');
  return [`@font-face{font-family:'${face}';src:url("${safe}") format('${webFontFormat(file.name)}');font-display:swap;}`];
 }).join('\n');
}
async function applyStyles(env=globalThis){
 if(!env.document?.head)return;
 let style=env.document.getElementById('ciyan-imported-font-style');
 if(!style){style=env.document.createElement('style');style.id='ciyan-imported-font-style';env.document.head.append(style);}
 style.textContent=compileImportedFontCSS('',urlById);
}
function createURL(id,record,env=globalThis){
 const old=urlById.get(id);if(old&&env.URL?.revokeObjectURL)env.URL.revokeObjectURL(old.url);
 const bytes=fileBytes(record);
 const mime=record.name.toLowerCase().endsWith('.woff2')?'font/woff2':record.name.toLowerCase().endsWith('.woff')?'font/woff':'font/ttf';
 const url=env.URL.createObjectURL(new env.Blob([bytes],{type:mime}));
 urlById.set(id,{name:record.name,url});
}
export async function initializeFontLibrary(env=globalThis){
 if(initialized)return getImportedFonts();
 try{
  const records=await readRecords(env);
  for(const record of records){if(!FONT_CATALOG[record.id]||!record.bytes)continue;imported.set(record.id,record);createURL(record.id,record,env);}
  await applyStyles(env);
  initialized=true;lastError=null;
 }catch(e){lastError=e.message||String(e);throw e;}
 return getImportedFonts();
}
// This check does NOT trust document.fonts.check(), which reported true for
// deliberately nonexistent fonts on the user's iPhone.
async function checkFontFile(id,record,env=globalThis){
 if(!env.FontFace)throw new Error('This browser cannot open custom font files.');
 const face=new env.FontFace(`CiyanValidation${id}`,fileBytes(record));
 try{await face.load();}catch(e){throw new Error(`The file is not a supported web font (${e?.message||'font decoder error'}).`);}
 if(face.status!=='loaded')throw new Error('Browser did not successfully decode the font.');
 // At this point bytes are decoded rather than silently matched by an iOS alias.
 return true;
}
// HTTP fetching is attempted only when a font is actually applied. Downloaded
// bytes are validated as real font data and persisted before being accepted.
// Concurrent requests for the same face share one in-flight Promise.
export async function acquireFontFromSource(id,env=globalThis){
 if(imported.has(id))return {id,source:imported.get(id).source||'upload',cached:true};
 if(downloads.has(id))return downloads.get(id);
 const task=(async()=>{
  if(!FONT_CATALOG[id])throw new Error('Unknown font.');
  const urls=FONT_REMOTE_SOURCES[id]||[];
  if(!urls.length)throw new Error('No downloadable web-font source is configured.');
  let last=null;
  for(const url of urls){
   try{
    if(!env.fetch)throw new Error('Web download unavailable in this browser.');
    const response=await env.fetch(url,{mode:'cors',cache:'default'});
    if(!response?.ok)throw new Error('Download HTTP '+(response?.status??'unknown'));
    const sizeHeader=Number(response.headers?.get('content-length')||0);
    if(sizeHeader>MAX_BYTES)throw new Error('Font exceeds the 30 MB download limit.');
    const bytes=await response.arrayBuffer();
    if(!bytes.byteLength||bytes.byteLength>MAX_BYTES)throw new Error('Downloaded font size invalid.');
    const ext=url.split('?')[0].split('.').at(-1).toLowerCase();
    const name=`${id}.${['ttf','otf','woff','woff2'].includes(ext)?ext:'ttf'}`;
    const record={id,name,size:bytes.byteLength,bytes,source:'download',importedAt:new Date().toISOString()};
    await checkFontFile(id,record,env);
    await putRecord(record,env);
    imported.set(id,record);checked.set(id,true);
    createURL(id,record,env);
    await applyStyles(env);
    return {id,source:'download',cached:false};
   }catch(error){last=error;}
  }
  throw new Error(`Could not download this font (${last?.message||'network unavailable'}). You can upload a font file instead.`);
 })().finally(()=>downloads.delete(id));
 downloads.set(id,task);return task;
}
export async function importFontFile(id,file,env=globalThis){
 if(!FONT_CATALOG[id])throw new Error('Unknown font slot.');
 if(!file||!VALID_EXT.test(file.name||''))throw new Error('Choose a .ttf, .otf, .woff, or .woff2 font file from iPhone Files.');
 if(!file.size||file.size>MAX_BYTES)throw new Error('Font file must be between 1 byte and 30 MB.');
 const bytes=await file.arrayBuffer();
 if(bytes.byteLength!==file.size)throw new Error('Font file read was incomplete.');
 const record={id,name:file.name,size:file.size,bytes,importedAt:new Date().toISOString()};
 await checkFontFile(id,record,env);
 // Persist first, so a failed write cannot appear as a successful import.
 await putRecord(record,env);
 const previous=imported.get(id);
 imported.set(id,record);checked.set(id,true);
 try{createURL(id,record,env);await applyStyles(env);}catch(e){
  // Source file remains saved: it will be available again after reopening.
  lastError=e.message||String(e);
  throw new Error('Font saved, but could not activate. Reopen Cíyán to retry: '+lastError);
 }
 return {id,name:record.name,size:record.size,replaced:Boolean(previous)};
}
export async function removeFontFile(id,env=globalThis){
 if(!FONT_CATALOG[id])return false;
 await removeRecord(id,env);
 imported.delete(id);checked.delete(id);
 const prev=urlById.get(id);if(prev){env.URL?.revokeObjectURL?.(prev.url);urlById.delete(id);}
 await applyStyles(env);return true;
}
export async function verifyImportedFontSelection(required,env=globalThis){
 if(!required?.length)return {ok:true,missing:[]};
 if(!initialized){try{await initializeFontLibrary(env);}catch(e){return {ok:false,missing:required,reason:e.message};}}
 const missing=[],errors=[];
 for(const id of required){
  let record=imported.get(id);
  if(!record){
   try{await acquireFontFromSource(id,env);record=imported.get(id);}
   catch(e){errors.push(`${id}: ${e.message}`);missing.push(id);continue;}
  }
  if(!checked.has(id)){
   try{await checkFontFile(id,record,env);checked.set(id,true);}catch(e){checked.set(id,false);errors.push(`${id}: ${e.message}`);}
  }
  if(!checked.get(id))missing.push(id);
 }
 return missing.length?{ok:false,missing,reason:errors.join(' | ')||'Font could not be decoded.'}:{ok:true,missing:[]};
}
export function clearFontValidationCache(){checked.clear();}
// Test-only reset: drops in-memory handles without deleting a user's IDB data.
export function resetFontLibraryForTesting(){for(const {url} of urlById.values())globalThis.URL?.revokeObjectURL?.(url);imported.clear();urlById.clear();checked.clear();downloads.clear();dbPromise=null;initialized=false;lastError=null;}
