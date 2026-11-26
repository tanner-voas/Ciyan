import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudNarrator} from '../reader-cloud-speech.js';
import {mandarinVoices,voiceDescription} from '../reader-speech.js';

test('duplicates collapse while distinct regions and installed quality tiers remain labeled',()=>{
 const base={name:'Tingting',lang:'zh-CN',localService:true};
 const voices=mandarinVoices(['compact.one','compact.two','enhanced.one'].map(voiceURI=>({...base,voiceURI})).concat({...base,lang:'zh-TW'}));
 assert.equal(voices.length,3);
 assert.equal(new Set(voices.map(voiceDescription)).size,3);
 assert.match(voiceDescription(voices.find(v=>v.lang==='zh-TW')),/Taiwan/);
});
test('Azure narration requests only the current sentence, reuses audio, and cancels stale playback',async()=>{
 const row={textContent:'我喜欢。明天去。'};
 const words=['我','喜欢'].map((textContent,i)=>({textContent,dataset:{offset:i},closest:()=>row}));row.querySelectorAll=()=>words;
 let requests=0,source,ended=0;const errors=[];
 class Context{
  state='running';currentTime=0;
  async decodeAudioData(){return {duration:1};}
  createBufferSource(){return source={connect(){},start(){},stop(){},disconnect(){}};}
  close(){return Promise.resolve();}
 }
 const win={AudioContext:Context,requestAnimationFrame(){return 1;},cancelAnimationFrame(){},
  async fetch(url,init){requests++;assert.equal(url,'https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1');
   assert.equal(init.headers['Ocp-Apim-Subscription-Key'],'test');assert.match(init.body,/我喜欢。/);assert.doesNotMatch(init.body,/明天/);
   return new Response(new Uint8Array(1));}};
 const n=createCloudNarrator(win,()=>{},()=>ended++,s=>errors.push(s));
 await n.speak(words[0],'zh-CN-YunxiNeural',240,'eastasia','test');source.onended();assert.equal(ended,1);
 await n.speak(words[0],'zh-CN-YunxiNeural',240,'eastasia','test');const stale=source.onended;n.cancel();stale();assert.equal(ended,1);assert.equal(requests,1);
 await n.speak(words[0],'zh-CN-YunxiNeural',240,'bad/region','test');assert.equal(errors.length,1);assert.equal(requests,1);
 n.dispose();
});

test('cache capacity changes take effect immediately and voice previews always fetch',async()=>{
 const {setSpeechCacheLimit,speechCacheCount,clearSpeechCache}=await import('../reader-cloud-speech.js');
 clearSpeechCache();setSpeechCacheLimit(2);
 let fetched=0;
 const win={cancelAnimationFrame(){},requestAnimationFrame(){},async fetch(){fetched++;return new Response(new Uint8Array(1));},
  AudioContext:class{state='running';currentTime=0;async decodeAudioData(){return {duration:1};}
   createBufferSource(){return {connect(){},disconnect(){},start(){},stop(){}};}async close(){}}
 };
 const player=createCloudNarrator(win,()=>{},()=>{},message=>assert.fail(message));
 const play=(text,options)=>player.speak(text,'zh-CN-YunxiNeural',120,'eastasia','fake-key',options);
 try{
  await play('甲');await play('乙');await play('甲');assert.equal(fetched,2);
  setSpeechCacheLimit(1);assert.equal(speechCacheCount(),1);
  await play('甲',{useCache:false});assert.equal(fetched,3);
  await play('甲');assert.equal(fetched,3);
  setSpeechCacheLimit(0);assert.equal(speechCacheCount(),0);
  await play('甲');await play('甲');assert.equal(fetched,5);assert.equal(speechCacheCount(),0);
 }finally{player.dispose();clearSpeechCache();setSpeechCacheLimit(8);}
});
test('R9 reports actual Azure attempts, prefetch and cache hits without text or credentials',async()=>{const {clearSpeechCache}=await import('../reader-cloud-speech.js');clearSpeechCache();const samples=[];let requests=0;const win={location:{origin:'https://ciyan.test'},crypto:globalThis.crypto,requestAnimationFrame(){return 1;},cancelAnimationFrame(){},AudioContext:class{state='running';currentTime=0;async decodeAudioData(){return {duration:1};}createBufferSource(){return {connect(){},disconnect(){},start(){},stop(){}};}async close(){}},async fetch(url,init){if(url.startsWith('/_profiles/')){samples.push(JSON.parse(init.body));assert.equal(init.credentials,'same-origin');return Response.json({accepted:true});}requests++;return new Response(new Uint8Array(1));}};const n=createCloudNarrator(win,()=>{},()=>{},message=>assert.fail(message));try{const args=['zh-CN-YunxiNeural',240,'eastasia','PRIVATE_KEY'];await n.speak('甲乙',...args,{ahead:['丙丁']});await n.speak('丙丁',...args);assert.equal(requests,2);assert.deepEqual(samples.map(x=>x.operation),['synthesis','prefetch','cache_hit']);assert.deepEqual(samples.map(x=>x.characters),[2,2,2]);assert.doesNotMatch(JSON.stringify(samples),/PRIVATE|甲乙|丙丁|eastasia|Yunxi/);}finally{n.dispose();clearSpeechCache();}});
