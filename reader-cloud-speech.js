import {captureUsage,recordProfileUsage} from './shared/google-drive/src/profile-usage.js';
import {speechPassage} from './reader-speech.js';

export const cloudVoices=new Map([
 ['zh-CN-YunxiNeural','Yunxi · male'],
 ['zh-CN-YunyangNeural','Yunyang · male']
]);

const xml=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);

// Decoded buffers can be reused across the reader, definitions and study.
const clips=new Map();
const pending=new Map();
let cacheGeneration=0,cacheLimit=8;
export function setSpeechCacheLimit(limit){
 if(!Number.isSafeInteger(limit)||limit<0)return;
 cacheLimit=Math.min(limit,64);
 while(clips.size>cacheLimit)clips.delete(clips.keys().next().value);
}
export function clearSpeechCache(){
 cacheGeneration++;
 for(const entry of pending.values())entry.controller.abort();
 pending.clear();clips.clear();
}
export const speechCacheCount=()=>clips.size;
// Observational only: do not delay playback or send SSML, text, voice, region
// or subscription credentials to the usage endpoint. No retries or extra Azure calls.
function reportUsage(win,operation,outcome,characters,durationMs,status){
 if(!win.location||!win.crypto?.randomUUID)return;try{const sample={id:win.crypto.randomUUID(),operation,outcome,characters,durationMs,...(status===undefined?{}:{status})};void win.fetch('/_profiles/v1/usage/azure-speech',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-PWA-CSRF':'1'},body:JSON.stringify(sample),cache:'no-store',keepalive:true,signal:AbortSignal.timeout(10000)}).catch(()=>{});}catch{}
}
async function loadClip(win,context,text,voice,cpm,region,key,pitch,useCache,prefetch=false){
 const usage=captureUsage();
 const rate=Math.round(Math.max(.5,Math.min(2,cpm/240))*100)-100;
 const id=useCache?JSON.stringify([voice,rate,pitch,text,region]):Symbol();
 if(clips.has(id)){if(!prefetch){reportUsage(win,'cache_hit','cache_hit',[...text].length,0);void recordProfileUsage(usage,{speechCacheHits:1});}const clip=clips.get(id);clips.delete(id);clips.set(id,clip);return clip;}
 if(pending.has(id))return pending.get(id).promise;
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),30000);
 const entry={controller};
 const started=Date.now(),operation=prefetch?'prefetch':'synthesis',characters=[...text].length;
 entry.promise=(async()=>{
  let status,outcome='error';try{const response=await win.fetch('https://'+region+'.tts.speech.microsoft.com/cognitiveservices/v1',{
   method:'POST',signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',
   headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3'},
   body:'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="'+voice+'"><prosody rate="'+rate+'%" pitch="'+pitch+'%">'+xml(text)+'</prosody></voice></speak>'
  });
  status=response.status;if(!response.ok)throw Error('Azure Speech returned '+response.status+'. Check credentials and quota.');
  const audio=await response.arrayBuffer();outcome='success';const clip=await context.decodeAudioData(audio);
  if(useCache&&cacheLimit&&!controller.signal.aborted){if(clips.size>=cacheLimit)clips.delete(clips.keys().next().value);clips.set(id,clip);}
  return clip;
  }catch(err){if(controller.signal.aborted&&outcome!=='success')outcome='cancelled';throw err;}finally{reportUsage(win,operation,outcome,characters,Date.now()-started,status);void recordProfileUsage(usage,{speechRequests:1,speechCharacters:characters});}
 })().finally(()=>{clearTimeout(timeout);if(pending.get(id)===entry)pending.delete(id);});
 pending.set(id,entry);return entry.promise;
}
export function createCloudNarrator(win,select,advance,failed){
 let context,source,frame,generation=0;
 function cancel(){
  generation++;win.cancelAnimationFrame(frame);
  if(source){source.onended=null;source.stop();source.disconnect();source=null;}
 }
 async function prepare(){
  context??=new (win.AudioContext||win.webkitAudioContext)();
  if(context.state!=='running')await context.resume();
 }
 async function speak(word,voice,cpm,region,key,{pitch=0,ahead=[],deadline=0,useCache=true}={}){
  cancel();const token=generation,cacheToken=cacheGeneration;
  if(!cloudVoices.has(voice)||!/^[a-z0-9]+$/.test(region)||!key){failed('Unlock Azure speech credentials in Speech settings.');return;}
  const {text,words,start}=typeof word==='string'?{text:word,words:[],start:0}:speechPassage(word);
  const load=(text,prefetch=false)=>loadClip(win,context,text,voice,cpm,region,key,pitch,useCache,prefetch);
  try{
   await prepare();
   if(token!==generation)return;
   const clip=await load(text);
   if(token!==generation)return;
   source=context.createBufferSource();source.buffer=clip;source.connect(context.destination);
   const began=context.currentTime+Math.max(0,deadline-performance.now())/1000;
   let i=0;
   function track(){
    if(token!==generation)return;
    const offset=start+text.length*(context.currentTime-began)/clip.duration;
    let next=i;while(next+1<words.length&&+words[next+1].dataset.offset<=offset)next++;
    if(next!==i){i=next;select(words[i]);}
    frame=win.requestAnimationFrame(track);
   }
   source.onended=()=>{if(token!==generation)return;win.cancelAnimationFrame(frame);source.disconnect();source=null;
    if(i<words.length-1)select(words.at(-1));advance();};
   source.start(began);track();
   for(const passage of ahead){if(token!==generation||cacheToken!==cacheGeneration)break;try{await load(passage,true);}catch{break;}}
  }catch(error){if(token===generation)failed(error.message);}
 }
 function dispose(){cancel();if(context)void context.close().catch(()=>{});}
 return {speak,prepare,cancel,dispose};
}
