import test from 'node:test';
import assert from 'node:assert/strict';
import profiles,{AccountCoordinator} from '../shared/google-drive/worker/index.js';
import {createTranslationWorker} from '../shared/pwa-core/worker/translation.js';
import gateway from '../worker.js';

// Exercise the actual versioned route and signature validation, not a mock
// which accepts any URL. Only the Google provider and durable storage are fake.
test('same-origin gateway authorizes translation using the real profiles Worker and signed session',async()=>{
 const origin='https://ciyan.example',secret='test-signing-key',enc=new TextEncoder(),db=new Map();
 const storage={get:async k=>db.get(k),put:async(k,v)=>db.set(k,v),delete:async k=>db.delete(k),list:async()=>new Map(),transaction:fn=>fn(storage)};
 const env={ALLOWED_ORIGINS:origin,SESSION_SIGNING_KEY:secret,NETWORK_TELEMETRY:'off'};
 const account=new AccountCoordinator({storage},env);
 env.ACCOUNTS={idFromName:x=>x,get:()=>account};
 const exp=Date.now()+60000,sid='test-session';await storage.put('session:'+sid,{exp,email:'test@example.test'});
 const body=Buffer.from(JSON.stringify({sub:'12345',sid,exp})).toString('base64url');
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,enc.encode(body))).toString('base64url');
 let calls=0,reserved=0;
 const translation=createTranslationWorker(async()=>{calls++;return Response.json({data:{translations:[{translatedText:'Hello'}]}});},()=>{});
 const translationEnv={ALLOWED_ORIGINS:origin,GOOGLE_TRANSLATE_API_KEY:'test-api-key',PROFILES:{fetch:r=>profiles.fetch(r,env)},TRANSLATION_BUDGET:{idFromName:x=>x,get:()=>({fetch:async(_,opts)=>{reserved+=JSON.parse(opts.body).count;return new Response('',{status:200});}})}};
 const gatewayEnv={COMMON:{fetch:r=>translation.fetch(r,translationEnv)}};
 const request=cookie=>new Request(origin+'/_translation/translate',{method:'POST',headers:{'Content-Type':'application/json','X-PWA-CSRF':'1',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({text:'你好',source:'zh-CN',target:'en'})});
 let res=await gateway.fetch(request('__Host-pwa_profile_session='+body+'.'+signature),gatewayEnv);assert.equal(res.status,200);assert.equal((await res.json()).text,'Hello');assert.equal(calls,1);assert.equal(reserved,2);
 res=await gateway.fetch(request(),gatewayEnv);assert.equal(res.status,401);assert.equal((await res.json()).code,'DISCONNECTED');
 await storage.delete('session:'+sid);res=await gateway.fetch(request('__Host-pwa_profile_session='+body+'.'+signature),gatewayEnv);assert.equal(res.status,401);assert.equal((await res.json()).code,'DISCONNECTED');assert.equal(calls,1);assert.equal(reserved,2);
});
