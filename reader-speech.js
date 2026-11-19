export function voiceDescription(v){
 const lang=v.lang.toLowerCase().replaceAll('_','-');
 const place=/-(tw|hant)(-|$)/.test(lang)?'Taiwan':/-(cn|hans)(-|$)/.test(lang)?'Mainland':lang;
 const id=(v.voiceURI||'')+' '+v.name;
 const tier=/premium/i.test(id)?'Premium':/enhanced/i.test(id)?'Enhanced':/compact/i.test(id)?'Compact':'';
 return [v.name,place,tier,v.localService?'Device':'Network'].filter(Boolean).join(' · ');
}

// Web Speech boundary indices and the reader's offsets both count UTF-16 code units.
export function mandarinVoices(voices){
 function rank(voice){
  const lang=voice.lang.toLowerCase().replaceAll('_','-');
  if(!/^(zh|cmn)(-|$)/.test(lang)||/-(hk|mo|yue)(-|$)/.test(lang)||/cantonese|粤语|廣東話/i.test(voice.name))return -1;
  return (voice.localService?8:0)+(/-(cn|hans)(-|$)/.test(lang)?4:0)+(/premium|enhanced|优质|增强/i.test(voice.name)?2:0)+(voice.default?1:0);
 }
 const unique=new Map();
 for(const v of voices.filter(v=>rank(v)>=0).sort((a,b)=>rank(b)-rank(a))){
  const label=voiceDescription(v);
  if(!unique.has(label))unique.set(label,v);
 }
 return [...unique.values()];
}

export function speechPassage(word){
 const row=word.closest('[data-pid]'),start=+word.dataset.offset;
 const rest=row.textContent.slice(start);
 const stop=rest.match(/[。！？!?……]+[”’」』）]*/u);
 const end=start+(stop?stop.index+stop[0].length:rest.length);
 const words=Array.from(row.querySelectorAll('[data-word-index]')).filter(w=>+w.dataset.offset>=start&&+w.dataset.offset<end);
 return {text:row.textContent.slice(start,end),start,words};
}

export function createNarrator(win,select,advance,failed){
 let active=null,timer,startTimeout;
 function cancel(){
  clearTimeout(startTimeout);clearTimeout(timer);
  if(active){active=null;win.speechSynthesis.cancel();}
 }
 function speak(word,voice,cpm,pitch=0){
  cancel();
  const {text,start,words}=typeof word==='string'?{text:word,start:0,words:[]}:speechPassage(word);
  const utterance=new win.SpeechSynthesisUtterance(text);
  active=utterance;
  if(voice)utterance.voice=voice;
  utterance.lang=voice?.lang||'zh-CN';utterance.volume=1;utterance.pitch=1+pitch/100;
  utterance.rate=Math.max(.4,Math.min(2.5,cpm/240));
  let index=0;
  function move(next){
   if(next>index){index=next;select(words[index]);}
  }
  // Some system voices omit word events. In that case interpolate within the
  // sentence, and always wait for the voice before advancing to the next one.
  function estimate(){
   clearTimeout(timer);
   if(index+1>=words.length)return;
   const chars=+words[index+1].dataset.offset-(+words[index].dataset.offset);
   timer=setTimeout(()=>{if(active===utterance){move(index+1);estimate();}},chars*60000/(240*utterance.rate));
  }
  let hasBoundaries=false;
  utterance.onstart=()=>{if(active===utterance){clearTimeout(startTimeout);if(!hasBoundaries)estimate();}};
  utterance.onboundary=e=>{
   if(active!==utterance||e.name==='sentence'||!Number.isFinite(e.charIndex))return;
   clearTimeout(startTimeout);
   const offset=start+e.charIndex;
   // A lone initial boundary carries no timing information.
   if(offset<=start)return;
   hasBoundaries=true;clearTimeout(timer);
   let next=index;
   while(next+1<words.length&&+words[next+1].dataset.offset<=offset)next++;
   move(next);
  };
  utterance.onend=()=>{
   if(active!==utterance)return;
   clearTimeout(startTimeout);clearTimeout(timer);active=null;move(words.length-1);advance();
  };
  function error(event){if(active===utterance){cancel();failed(event?.error||'start-timeout');}}
  utterance.onerror=error;
  startTimeout=setTimeout(error,10000);
  try{
   if(win.speechSynthesis.paused)win.speechSynthesis.resume();
   win.speechSynthesis.speak(utterance);
  }catch{error();}
 }
 return {cancel,speak};
}
