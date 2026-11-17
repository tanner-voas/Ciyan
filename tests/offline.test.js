import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
test('service worker precaches app and the complete master collection without forced activation',async()=>{
 const handlers={},cached=[];let skipped=false;
 const manifest=JSON.parse(fs.readFileSync(new URL('../decks/manifest.json',import.meta.url)));
 vm.runInNewContext(source,{self:{addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>{skipped=true;}},fetch:async()=>({ok:true,json:async()=>manifest}),caches:{open:async()=>({addAll:async items=>cached.push(...items)})}});
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;
 assert.equal(skipped,false);assert.ok(cached.includes('./master-data.js'));assert.ok(!cached.some(p=>p.startsWith('./decks/')));
 for(const path of cached.filter(p=>p!=='./'))assert.ok(fs.existsSync(new URL('../'+path.slice(2),import.meta.url)),path);
});
test('service worker removes only its own obsolete caches',async()=>{
 const handlers={},deleted=[];
 vm.runInNewContext(source,{self:{addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{}}},caches:{keys:async()=>['other-app-cache','ciyan-shell-v2','ciyan-shell-v3','ciyan-shell-v3.1'],delete:async k=>deleted.push(k)}});
 let pending;handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['ciyan-shell-v2','ciyan-shell-v3','ciyan-shell-v3.1']);
});
