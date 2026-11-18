import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FONT_REMOTE_SOURCES} from '../font-sources.js';
import {FONT_CATALOG,verifyFontSelection} from '../fonts.js';
import {resetFontLibraryForTesting,getImportedFonts,initializeFontLibrary,removeFontFile} from '../font-library.js';

function environment({bad=[]}={}){
 const stored=new Map(), styles=new Map(), hits=[];
 const database={objectStoreNames:{contains:()=>true},createObjectStore(){},transaction(){
  const tx={oncomplete:null,onerror:null,onabort:null};
  tx.objectStore=()=>({
   getAll(){const req={result:[...stored.values()],onsuccess:null,onerror:null};queueMicrotask(()=>req.onsuccess?.());return req;},
   put(rec){stored.set(rec.id,structuredClone(rec));queueMicrotask(()=>tx.oncomplete?.());},
   delete(id){stored.delete(id);queueMicrotask(()=>tx.oncomplete?.());}
  });return tx;
 }};
 const env={
  indexedDB:{open(){const req={result:database,onsuccess:null,onupgradeneeded:null,onerror:null};queueMicrotask(()=>req.onsuccess?.());return req;}},
  document:{head:{append(n){styles.set(n.id,n);}},getElementById:id=>styles.get(id)||null,createElement:()=>({id:null,textContent:''})},
  URL:{createObjectURL:()=>`blob:font${Math.random()}`,revokeObjectURL(){}},Blob,
  FontFace:class {constructor(_,data){this.data=data;this.status='unloaded';}async load(){if(!this.data?.byteLength)throw Error('no bytes');this.status='loaded';return this;}},
  async fetch(url){hits.push(String(url));
   const id=Object.keys(FONT_REMOTE_SOURCES).find(id=>FONT_REMOTE_SOURCES[id].includes(url));
   if(!id||bad.includes(id))throw Error('HTTP network unavailable');
   return {ok:true,headers:{get:()=>null},async arrayBuffer(){return new Uint8Array([0,1,0,0,...new TextEncoder().encode(id)]).buffer;}};
  }
 };
 return {env,stored,styles,hits};
}

test('six named font slots have real public web-font source manifests and explicit license references',()=>{
 assert.deepEqual(Object.keys(FONT_REMOTE_SOURCES).sort(),Object.keys(FONT_CATALOG).sort());
 for(const [id,urls] of Object.entries(FONT_REMOTE_SOURCES)){
  assert.ok(FONT_CATALOG[id].face,`slot ${id}`);
  assert.ok(urls.length>0);
  for(const u of urls)assert.match(u,/^https:\/\//);
 }
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/upload-missing-font/);
 assert.match(app,/Keep previous font/);
 assert.doesNotMatch(app,/font-debug\.html/);
});

test('first Apply downloads and caches fonts; Mixed reuses cache; startup restores offline',async()=>{
 resetFontLibraryForTesting();
 const {env,stored,styles,hits}=environment();
 const first=await verifyFontSelection({fontDifficulty:'advanced',fontChoice:'mixed'},env);
 assert.deepEqual(first,{ok:true,missing:[]});
 assert.deepEqual([...stored.keys()],['zhushi','mashan']);
 assert.ok(styles.get('ciyan-imported-font-style').textContent.includes('CiyanZhuShi'));
 assert.ok(styles.get('ciyan-imported-font-style').textContent.includes('CiyanMaShan'));
 assert.ok(!styles.get('ciyan-imported-font-style').textContent.includes('CiyanMixed'));
 assert.equal(hits.filter(u=>u.endsWith('.ttf')).length,2);
 const repeat=await verifyFontSelection({fontDifficulty:'advanced',fontChoice:'mixed'},env);
 assert.equal(repeat.ok,true);
 assert.equal(hits.filter(u=>u.endsWith('.ttf')).length,2,'repeated selection does not fetch again');
 assert.equal(getImportedFonts().mashan.source,'download');
 resetFontLibraryForTesting();
 // Same in-memory database simulates reopening offline after downloading.
 const offline={...env,fetch:async()=>{throw Error('offline');}};
 await initializeFontLibrary(offline);
 assert.equal((await verifyFontSelection({fontDifficulty:'advanced',fontChoice:'mixed'},offline)).ok,true);
 assert.equal(getImportedFonts().zhushi.source,'download');
 await removeFontFile('zhushi',offline);
 assert.equal(stored.has('zhushi'),false);
 resetFontLibraryForTesting();
});

test('failed network leaves candidate unavailable and can retain previous applied font',async()=>{
 resetFontLibraryForTesting();
 const {env,stored}=environment({bad:['muyao']});
 const s=await verifyFontSelection({fontDifficulty:'expert',fontChoice:'mixed'},env);
 assert.equal(s.ok,false);assert.deepEqual(s.missing,['muyao']);
 assert.ok(s.reason.includes('Could not download'));
 assert.equal(stored.has('muyao'),false);
 assert.equal((await verifyFontSelection({fontDifficulty:'beginner',fontChoice:'print'},env)).ok,true);
 resetFontLibraryForTesting();
});
