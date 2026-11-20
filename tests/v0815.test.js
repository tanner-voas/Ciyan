import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {homeScreen,activeAppId,appLaunchUrl} from '../launcher.js';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';

const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8');

function workerHarness({cached,network}={}){
  const handlers={},lookups=[];
  vm.runInNewContext(source,{
    URL,Request,Response,
    self:{location:{origin:'https://ciyan.example'},registration:{scope:'https://ciyan.example/'},addEventListener:(type,callback)=>{handlers[type]=callback;}},
    caches:{match:async key=>{lookups.push(String(key));return cached?.(key)||null;}},
    fetch:async request=>network?.(request)||new Response('network content',{headers:{'Content-Type':'text/html'}})
  });
  return {handlers,lookups,async navigate(url){
    let promise;
    handlers.fetch({request:{url,method:'GET',mode:'navigate'},respondWith(value){promise=value;}});
    return await promise;
  }};
}

test('v0.8.15 protects Safari from redirected cached HTML for both launcher and app routes, even offline',async()=>{
  const html='<html><body>Offline shell</body></html>';
  const w=workerHarness({cached:key=>{
    if(String(key)!=='https://ciyan.example/index.html')return null;
    const redirected=new Response(html,{headers:{'content-type':'text/html'}});
    Object.defineProperty(redirected,'redirected',{value:true});
    return redirected;
  },network:()=>{throw Error('network should not be used');}});
  for(const url of ['https://ciyan.example/','https://ciyan.example/?app=ciyan','https://ciyan.example/index.html?app=ciyan']){
    const result=await w.navigate(url);
    assert.equal(result.redirected,false);
    assert.equal(result.status,200);
    assert.equal(result.headers.get('content-type'),'text/html');
    assert.equal(await result.text(),html);
  }
  assert.deepEqual(w.lookups,['https://ciyan.example/index.html','https://ciyan.example/index.html','https://ciyan.example/index.html']);
});

test('v0.8.15 normalizes redirected network navigations as well as cached responses',async()=>{
  const w=workerHarness({network:()=>{
    const r=new Response('fresh document',{status:200});
    Object.defineProperty(r,'redirected',{value:true});
    return r;
  }});
  const response=await w.navigate('https://ciyan.example/?app=ciyan');
  assert.equal(response.redirected,false);
  assert.equal(await response.text(),'fresh document');
});

test('v0.8.15 launcher selects a module without an anchor-driven page change',()=>{
  const markup=homeScreen('https://ciyan.example/');
  assert.match(markup,/data-launch-app="ciyan"/);
  assert.match(markup,/href="https:\/\/ciyan.example\/\?app=ciyan"/);
  const js=readFileSync(new URL('../launcher.js',import.meta.url),'utf8');
  assert.match(js,/event.preventDefault\(\)/);
  assert.match(js,/history.replaceState\(null,'',appLaunchUrl/);
  assert.match(js,/await import\(selected.module\)/);
  assert.equal(activeAppId(appLaunchUrl('https://ciyan.example/','ciyan')),'ciyan');
  assert.equal(APP_VERSION,'0.8.15');
  assert.equal(prepareVersionedBackup({appVersion:'0.8.14',state:{revision:1}}).appVersion,'0.8.15');
});
