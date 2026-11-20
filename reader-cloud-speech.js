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
async function loadClip(win,context,text,voice,cpm,region,key,pitch,useCache){
 const rate=Math.round(Math.max(.5,Math.min(2,cpm/240))*100)-100;
 const id=useCache?JSON.stringify([voice,rate,pitch,text,region]):Symbol();
 if(clips.has(id)){const clip=clips.get(id);clips.delete(id);clips.set(id,clip);return clip;}
 if(pending.has(id))return pending.get(id).promise;
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),30000);
 const entry={controller};
 entry.promise=(async()=>{
  const response=await win.fetch('https://'+region+'.tts.speech.microsoft.com/cognitiveservices/v1',{
   method:'POST',signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',
   headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3'},
   body:'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="'+voice+'"><prosody rate="'+rate+'%" pitch="'+pitch+'%">'+xml(text)+'</prosody></voice></speak>'
  });
  if(!response.ok)throw Error('Azure Speech returned '+response.status+'. Check credentials and quota.');
  const clip=await context.decodeAudioData(await response.arrayBuffer());
  if(useCache&&cacheLimit&&!controller.signal.aborted){if(clips.size>=cacheLimit)clips.delete(clips.keys().next().value);clips.set(id,clip);}
  return clip;
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
  const load=text=>loadClip(win,context,text,voice,cpm,region,key,pitch,useCache);
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
   for(const passage of ahead){if(token!==generation||cacheToken!==cacheGeneration)break;try{await load(passage);}catch{break;}}
  }catch(error){if(token===generation)failed(error.message);}
 }
 function dispose(){cancel();if(context)void context.close().catch(()=>{});}
 return {speak,prepare,cancel,dispose};
}
