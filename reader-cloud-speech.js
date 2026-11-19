import {speechPassage} from './reader-speech.js';

export const cloudVoices=new Map([
 ['zh-CN-YunxiNeural','Yunxi · male'],
 ['zh-CN-YunyangNeural','Yunyang · male']
]);

const xml=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);

export function createCloudNarrator(win,select,advance,failed){
 let context,request,source,frame;
 const clips=new Map();
 function cancel(){
  request?.abort();request=null;
  if(source){source.onended=null;source.stop();source.disconnect();source=null;}
  win.cancelAnimationFrame(frame);
 }
 async function speak(word,voice,cpm,region,key){
  cancel();
  if(!cloudVoices.has(voice)||!/^[a-z0-9]+$/.test(region)||!key){
   failed('Enter your Azure Speech region and key in the reader menu.');return;
  }
  const token=new AbortController();request=token;
  const {text,words,start}=speechPassage(word);
  const percent=Math.round(Math.max(.5,Math.min(2,cpm/240))*100)-100;
  const id=JSON.stringify([voice,percent,text]);
  const timeout=setTimeout(()=>{if(request===token){cancel();failed('Azure Speech timed out. Tap Play to retry.');}},30000);
  try{
   // Resume in the Play interaction before waiting for the network.
   context??=new (win.AudioContext||win.webkitAudioContext)();
   if(context.state!=='running')await context.resume();
   if(token!==request)return;
   let clip=clips.get(id);
   if(!clip){
    const response=await win.fetch('https://'+region+'.tts.speech.microsoft.com/cognitiveservices/v1',{
     method:'POST',signal:token.signal,credentials:'omit',referrerPolicy:'no-referrer',
     headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3'},
     body:'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="'+voice+'"><prosody rate="'+(percent>=0?'+':'')+percent+'%">'+xml(text)+'</prosody></voice></speak>'
    });
    if(!response.ok)throw Error('Azure Speech returned '+response.status+'. Check the region, key and available quota.');
    clip=await context.decodeAudioData(await response.arrayBuffer());
    if(request!==token)return;
    if(clips.size>=8)clips.delete(clips.keys().next().value);
    clips.set(id,clip);
   }
   if(request!==token||token.signal.aborted)return;
   source=context.createBufferSource();source.buffer=clip;source.connect(context.destination);
   const began=context.currentTime;let i=0;
   function track(){
    if(request!==token)return;
    const offset=start+text.length*(context.currentTime-began)/clip.duration;
    let next=i;
    while(next+1<words.length&&+words[next+1].dataset.offset<=offset)next++;
    if(next!==i){i=next;select(words[i]);}
    frame=win.requestAnimationFrame(track);
   }
   source.onended=()=>{
    if(request!==token)return;
    win.cancelAnimationFrame(frame);source.disconnect();source=null;request=null;
    if(i<words.length-1)select(words.at(-1));advance();
   };
   source.start();track();
  }catch(error){
   if(request===token)failed(error.message);
  }finally{clearTimeout(timeout);}
 }
 function dispose(){cancel();clips.clear();if(context)void context.close().catch(()=>{});}
 return {speak,cancel,dispose};
}
