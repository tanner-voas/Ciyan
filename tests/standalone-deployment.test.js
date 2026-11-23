import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {hasLauncherHost,runUpdateButton,returnToLauncher} from '../app-host-bridge.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const modPath=new URL('../dist/ciyan/',import.meta.url);
const standalonePath=new URL('../dist/standalone/',import.meta.url);
const read=(url,path)=>fs.readFileSync(new URL(path,url),'utf8');

test('one build provides a standalone Worker bundle and a separate AppLauncher module',()=>{
  execFileSync('python3',['package.py'],{cwd:root});
  const config=read(new URL('../',import.meta.url),'wrangler.jsonc');
  assert.match(config,/"name"\s*:\s*"ciyan"/);
  assert.match(config,/"directory"\s*:\s*"\.\/dist\/standalone"/);
  for(const asset of ['index.html','app.js','app-host-bridge.js','pwa-update.js','viewport-lock.js','manifest.webmanifest','standalone-boot.js','sw.js','styles.css','chapters/index.js'])
    assert.ok(fs.existsSync(new URL(asset,standalonePath)),`missing standalone ${asset}`);
  for(const asset of ['app.js','app-host-bridge.js','styles.css','chapters/index.js'])
    assert.ok(fs.existsSync(new URL(asset,modPath)),`missing launcher module ${asset}`);
  for(const shell of ['index.html','sw.js','manifest.webmanifest','standalone-boot.js','pwa-update.js'])
    assert.equal(fs.existsSync(new URL(shell,modPath)),false,`host shell leaked into module: ${shell}`);
  const html=read(standalonePath,'index.html');
  assert.match(html,/Cíyán v0\.9\.7/);
  assert.match(html,/src="\.\/standalone-boot\.js"/);
  assert.doesNotMatch(html,/My Workspace|launcher\.js|apps-registry/);
  const manifest=JSON.parse(read(standalonePath,'manifest.webmanifest'));
  assert.equal(manifest.name,'Cíyán — Mandarin flashcards');
  assert.equal(manifest.start_url,'./');
  assert.match(read(standalonePath,'standalone-boot.js'),/import\('\.\/app\.js'\)/);
});

test('standalone updater uses its own SW, but launcher API remains authoritative when hosted',async()=>{
  const saved=globalThis.__APP_LAUNCHER__;
  try{
    delete globalThis.__APP_LAUNCHER__;
    assert.equal(hasLauncherHost(),false);
    assert.throws(()=>returnToLauncher(),/no launcher/);
    let checked=0,reloaded=0;
    const button={disabled:false,innerHTML:'Refresh',textContent:'',setAttribute(){},removeAttribute(){}};
    const ok=await runUpdateButton(button,{
      navigatorRef:{onLine:true,serviceWorker:{register:async()=>({waiting:null,installing:null,async update(){checked++}})}},
      locationRef:{reload(){reloaded++}},timeoutMs:100
    });
    assert.equal(ok,true);
    assert.equal(checked,1);
    assert.equal(reloaded,1);
    assert.equal(button.disabled,false);
    let hostUpdates=0,exits=0;
    globalThis.__APP_LAUNCHER__={runUpdateButton:async()=>{hostUpdates++;return 'host'},returnToLauncher:()=>{exits++}};
    assert.equal(hasLauncherHost(),true);
    assert.equal(await runUpdateButton(button), 'host');
    returnToLauncher();
    assert.equal(hostUpdates,1);
    assert.equal(exits,1);
  }finally{
    if(saved===undefined)delete globalThis.__APP_LAUNCHER__;
    else globalThis.__APP_LAUNCHER__=saved;
  }
});

test('offline standalone cache refreshes on build changes without deleting reader content',()=>{
  const code=read(standalonePath,'sw.js');
  assert.match(code,/ciyan-shell-v0\.9\.7-[a-f0-9]{16}/);
  assert.match(code,/"\.\/index\.html"/);
  assert.match(code,/"\.\/app\.js"/);
  assert.match(code,/"\.\/chapters\/index\.js"/);
  assert.match(code,/"\.\/pwa-update\.js"/);
  assert.match(code,/new Response\(response\.body/);
  assert.match(code,/k\.startsWith\('ciyan-shell-'\)/);
  assert.doesNotMatch(code,/k\.startsWith\('ciyan-reader-text/);
  assert.doesNotMatch(code,/k\.startsWith\('ciyan-user-fonts/);
  const handlers={},lookups=[];
  const redirected={status:200,statusText:'OK',headers:{},body:'<html>ok</html>',redirected:true};
  vm.runInNewContext(code,{
    URL, Request:class{constructor(url){this.url=url}},Response:class{constructor(body,options){this.body=body;this.status=options.status;this.redirected=false}},
    caches:{match:async key=>{lookups.push(String(key));return redirected}},fetch:async()=>{throw new Error('offline')},
    self:{location:{origin:'https://ciyan.example'},registration:{scope:'https://ciyan.example/'},addEventListener:(name,fn)=>handlers[name]=fn}
  });
  return Promise.all(['https://ciyan.example/','https://ciyan.example/?old=1'].map(async url=>{
    let pending;
    handlers.fetch({request:{url,method:'GET',mode:'navigate'},respondWith:promise=>pending=promise});
    const result=await pending;
    assert.equal(result.status,200);
    assert.equal(result.redirected,false);
  })).then(()=>assert.deepEqual(lookups,['https://ciyan.example/index.html','https://ciyan.example/index.html']));
});
