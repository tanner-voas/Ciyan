import test from 'node:test';
import assert from 'node:assert/strict';
import {createReader} from '../reader-ui.js';

test('private translation works without the badge and retains attribution fallback', async t=>{
 const oldDocument=globalThis.document,oldFetch=globalThis.fetch;
 t.after(()=>{globalThis.document=oldDocument;globalThis.fetch=oldFetch;});
 const requests=[];
 globalThis.fetch=async(url,options)=>{
  requests.push(url);
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
 assert.deepEqual(requests,['/_translation/translate']);
 assert.equal(target.hidden,false);
 assert.equal(target.textContent,'Hello.');
 assert.equal(button.textContent,'Hide translation');
 const link=target.children[0],img=link.children[0];
 assert.equal(img.src,'./icons/google-translate-attribution.png');
 assert.equal(img.alt,'Powered by Google Translate');
 img.error();
 assert.equal(link.textContent,'Powered by Google Translate');
});
