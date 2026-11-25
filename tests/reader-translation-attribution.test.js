import test from 'node:test';
import assert from 'node:assert/strict';
import {createReader} from '../reader-ui.js';

test('translation requires the official badge and retains attribution fallback', async t=>{
 const oldDocument=globalThis.document,oldFetch=globalThis.fetch;
 t.after(()=>{globalThis.document=oldDocument;globalThis.fetch=oldFetch;});
 const requests=[];
 globalThis.fetch=async(url,options)=>{
  requests.push(url);
  if(url==='./reader-assets/google-translate-attribution.png')return new Response('png',{headers:{'Content-Type':'image/png'}});
  assert.equal(url,'/_translation/translate');
  assert.equal(JSON.parse(options.body).text,'你好。');
  return Response.json({text:'Hello.'});
 };
 globalThis.document={addEventListener(){},createElement(tag){return {tag,children:[],append(child){this.children.push(child);},addEventListener(name,fn){this[name]=fn;}};}};
 const reader=createReader({state:()=>({settings:{}})});
 const passage={dataset:{chinese:'你好。'}};
 const target={hidden:true,children:[],append(child){this.children.push(child);}};
 const row={isConnected:true,querySelector(selector){return selector==='[data-chinese]'?passage:target;}};
 const button={disabled:false,closest:()=>row};
 await reader.action('translate',button);
 assert.deepEqual(requests,['./reader-assets/google-translate-attribution.png','/_translation/translate']);
 assert.equal(target.hidden,false);
 assert.equal(target.textContent,'Hello.');
 assert.equal(button.textContent,'Hide translation');
 const link=target.children[0],img=link.children[0];
 assert.equal(img.src,'./reader-assets/google-translate-attribution.png');
 assert.equal(img.alt,'Powered by Google Translate');
 img.error();
 assert.equal(link.textContent,'Powered by Google Translate');
});

test('missing or non-image badge blocks the translation request',async t=>{
 const oldFetch=globalThis.fetch,oldDocument=globalThis.document;t.after(()=>{globalThis.fetch=oldFetch;globalThis.document=oldDocument;});
 globalThis.document={addEventListener(){}};let calls=0;globalThis.fetch=async url=>{calls++;assert.equal(url,'./reader-assets/google-translate-attribution.png');return new Response('<html>',{headers:{'Content-Type':'text/html'}});};
 const target={hidden:true};const row={isConnected:true,querySelector:s=>s==='[data-chinese]'?{dataset:{chinese:'再见。'}}:target};const button={disabled:false,closest:()=>row};
 await createReader({state:()=>({settings:{}})}).action('translate',button);assert.equal(calls,1);assert.match(target.textContent,/attribution badge/);assert.equal(button.textContent,'Retry translation');
});
