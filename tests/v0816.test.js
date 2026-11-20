import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {homeScreen} from '../launcher.js';
import {checkForUpdatesAndReload,runUpdateButton} from '../pwa-update.js';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';

const projectFile=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('v0.8.16 minimal My Workspace launcher only shows heading, refresh and app tiles',()=>{
 const markup=homeScreen('https://ciyan.example/');
 assert.match(markup,/<h1 class="launcher-workspace-title">My Workspace<\/h1>/);
 assert.match(markup,/data-update-launcher/);
 assert.match(markup,/data-launch-app="ciyan"/);
 assert.doesNotMatch(markup,/>My Apps<|Installed apps|Your apps, in one place|launcher-monogram|YOUR WORKSPACE/);
 assert.doesNotMatch(markup,/Mandarin learning/);
 const css=projectFile('styles.css');
 assert.match(css,/\.launcher-grid\{margin-top:42px/);
 assert.match(css,/\.launcher-mode \.app-frame\{[^}]*height:auto/);
});

test('v0.8.16 the document zoom lock preserves regular scrolling',()=>{
 const listeners=new Map();
 const document={addEventListener:(name,fn,opts)=>listeners.set(name,{fn,opts})};
 vm.runInNewContext(projectFile('viewport-lock.js'),{document});
 for(const type of ['gesturestart','gesturechange','touchmove','wheel']){
   assert.equal(listeners.get(type).opts.passive,false,type);
 }
 let prevented=0;const event={cancelable:true,touches:[{}],preventDefault(){prevented++;}};
 listeners.get('touchmove').fn(event);
 assert.equal(prevented,0,'single-finger scrolling must work');
 event.touches.push({});listeners.get('touchmove').fn(event);
 assert.equal(prevented,1,'pinch gestures must be blocked');
 listeners.get('gesturestart').fn(event);assert.equal(prevented,2);
 listeners.get('wheel').fn({...event,ctrlKey:false});assert.equal(prevented,2);
 listeners.get('wheel').fn({...event,ctrlKey:true});assert.equal(prevented,3);
});

test('shared updater reloads immediately when no new service worker is waiting',async()=>{
 let updates=0,reloads=0;const statuses=[];
 const registration={waiting:null,installing:null,async update(){updates++;}};
 const service={async register(url,options){assert.equal(url,'./sw.js');assert.equal(options.updateViaCache,'none');return registration;}};
 const locationRef={reload(){reloads++;}};
 await checkForUpdatesAndReload({navigatorRef:{onLine:true,serviceWorker:service},locationRef,onStatus:status=>statuses.push(status),timeoutMs:100});
 assert.equal(updates,1);assert.equal(reloads,1);
 assert.deepEqual(statuses,['Checking for updates…','Reloading…']);
});

test('shared updater handles auto-activating worker when controllerchange is delayed',async()=>{
 const listeners={};let reloads=0;
 const worker={state:'installing',addEventListener(event,fn){listeners[event]=fn;},removeEventListener(){}};
 const service={controller:{state:'activated'},addEventListener(){},removeEventListener(){},async register(){return {waiting:null,installing:worker,async update(){worker.state='activated';}};}};
 await checkForUpdatesAndReload({navigatorRef:{onLine:true,serviceWorker:service},locationRef:{reload(){reloads++;}},timeoutMs:200});
 assert.equal(reloads,1,'already-activated worker must not stall for controllerchange');
});

test('shared updater activates a waiting worker and still reloads',async()=>{
 let reloads=0,posted=0;const listeners=new Map();
 const service={controller:{},addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);}};
 const worker={state:'installed',addEventListener(){},removeEventListener(){},postMessage(message){
   assert.equal(message,'activate-update');posted++;this.state='activated';service.controller=this;
   listeners.get('controllerchange')?.();
 }};
 service.register=async()=>({waiting:worker,installing:null,async update(){}});
 await checkForUpdatesAndReload({navigatorRef:{onLine:true,serviceWorker:service},locationRef:{reload(){reloads++;}},timeoutMs:200});
 assert.equal(posted,1);assert.equal(reloads,1);
});

test('failed update stops with a visible error and restores the refresh control',async()=>{
 const button={innerHTML:'<svg></svg>',disabled:false,textContent:'',setAttribute(){},removeAttribute(){}};
 let errorMessage='';const navigatorRef={onLine:true,serviceWorker:{register:async()=>({waiting:null,installing:null,update:()=>new Promise(()=>{})})}};
 const success=await runUpdateButton(button,{navigatorRef,locationRef:{reload(){assert.fail('must not reload on failure');}},timeoutMs:15,onError:e=>errorMessage=e});
 assert.equal(success,false);
 assert.match(errorMessage,/timed out/);
 assert.equal(button.disabled,false);
 assert.equal(button.innerHTML,'<svg></svg>');
});

test('v0.8.16 is a no-data-loss identity migration from v0.8.15',()=>{
 assert.equal(APP_VERSION,'0.8.16');
 const original={appVersion:'0.8.15',state:{revision:23,readerProgress:{a:1},activeSession:{id:'lesson'}}};
 const updated=prepareVersionedBackup(original);
 assert.equal(updated.appVersion,'0.8.16');
 assert.deepEqual(updated.state,original.state);
 assert.equal(original.appVersion,'0.8.15');
 const sw=projectFile('sw.js');
 assert.match(sw,/ciyan-shell-v8\.16/);
 assert.match(sw,/\.\/pwa-update\.js/);
 assert.match(sw,/\.\/viewport-lock\.js/);
 const pkg=projectFile('package.py');
 assert.match(pkg,/"pwa-update\.js"/);
 assert.match(pkg,/"viewport-lock\.js"/);
});
