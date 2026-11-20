import {voiceTuning,speechPassage,mandarinVoices,voiceDescription,createNarrator} from './reader-speech.js';
import {cloudVoices,createCloudNarrator} from './reader-cloud-speech.js';
// The document scrolls as one reading surface. Word indices count annotated
// words in a paragraph, while offset keeps older character-based bookmarks usable.
export function mountReadingGuide(pages,{position,save,define,rateChanged,initialRate,extend,speechSettings=()=>({}),credentials=async()=>({}),voiceChanged=()=>{},initialGuide=false,initialAudio=false,onPlaybackChange=()=>{},onTap=()=>{}}){
 const doc=pages.ownerDocument,win=doc.defaultView;
 const listeners=new AbortController(),options={signal:listeners.signal};
 const toolbar=pages.querySelector('[data-guide-controls]');
 const toggle=pages.querySelector('[data-guide="toggle"]');
 const play=toolbar.querySelector('[data-guide="play"]');
 const rateLabel=toolbar.querySelector('output');
 let wordList=Array.from(pages.querySelectorAll('[data-word-index]'));
 const rows=()=>pages.querySelectorAll('[data-pid]');
 let current=null,enabled=false,playing=false,rate=initialRate;
 let tick,frame,stopped=false;
 const audio=pages.querySelector('[data-guide-audio]');
 const speechStatus=pages.querySelector('[data-speech-status]');
 const voiceSelect=pages.querySelector('[data-voice-select]');
 let voices=[],aloud=false,sequence=0,systemFallback=null;
 const synth=win.speechSynthesis;
 const session=win.navigator?.audioSession;
 let previousType;
 function usePlayback(){
  if(!session||previousType!==undefined)return;
  try{previousType=session.type;session.type='playback';}catch{previousType=undefined;}
 }
 function releasePlayback(){
  if(previousType!==undefined){try{session.type=previousType;}catch{}previousType=undefined;}
 }
 const narrator=createNarrator(win,select,()=>void step(1,true),reason=>{
  const fallback=voices.find(v=>v.localService);
  if(playing&&!systemFallback&&!voiceSelect.value&&fallback){
   systemFallback=fallback;narrator.speak(current,fallback,rate);return;
  }
  pause();speechStatus.textContent='Mandarin audio could not play ('+reason+'). Check media volume and output, or choose another voice and tap Play.';
 });
 const menu=pages.querySelector('[data-reader-settings-sheet]'),dock=pages.querySelector('.reader-dock');
 const audioControls=pages.querySelector('[data-audio-controls]');
 const config=pages.querySelector('[data-cloud-config]');

 function cloudFailed(msg){
  const local=voices.find(v=>v.localService);
  if(playing&&local){systemFallback=local;speechStatus.textContent=msg+' Using '+local.name+'.';narrator.speak(current,local,rate,voiceTuning(speechSettings(),voiceSelect.value).speechPitch);}
  else{pause();speechStatus.textContent=msg;}
 }
 const cloud=createCloudNarrator(win,select,()=>void step(1,true),cloudFailed);
 function refreshVoices(){
  voices=mandarinVoices(synth?.getVoices()||[]);
  function option(value,text){const o=doc.createElement('option');o.value=value;o.textContent=text;return o;}
  const local=doc.createElement('optgroup');local.label='System voices';
  if(synth&&win.SpeechSynthesisUtterance)local.append(option('','System Mandarin'),...voices.map(v=>option(v.voiceURI,voiceDescription(v))));
  const online=doc.createElement('optgroup');online.label='Azure neural · key required';
  for(const [id,label] of cloudVoices)online.append(option(id,label));
  voiceSelect.replaceChildren(local,online);
  const preferred=voiceSelect.dataset.selected;
  if(cloudVoices.has(preferred)||voices.some(v=>v.voiceURI===preferred))voiceSelect.value=preferred;
  audioControls.hidden=!aloud;
  config.hidden=false;
 }
 if(voiceSelect?.matches?.('[data-voice-select]')){
  refreshVoices();synth?.addEventListener?.('voiceschanged',refreshVoices,options);
  audio.addEventListener('click',()=>{
   aloud=audio.checked;systemFallback=null;refreshVoices();
   if(aloud&&!enabled){switchGuide(true);}
   onPlaybackChange(enabled,aloud);
   if(!aloud)releasePlayback();
   schedule();
  },options);
  voiceSelect.addEventListener('change',()=>{
   voiceSelect.dataset.selected=voiceSelect.value;systemFallback=null;speechStatus.textContent='';
   refreshVoices();
   rate=voiceTuning(speechSettings(),voiceSelect.value).readerCpm;rateLabel.textContent=rate+' CPM';
   void voiceChanged(voiceSelect.value);
   schedule();
  },options);
 }
 const viewport=()=>win.visualViewport;
 function bookmark(row,word){
  if(row)save(+row.closest('article').dataset.readerNumber,{id:row.dataset.pid,index:+row.dataset.index,
   wordIndex:word?+word.dataset.wordIndex:0,offset:word?+word.dataset.offset:0});
 }
 function topEdge(){
  return parseFloat(win.getComputedStyle(pages).getPropertyValue('scroll-padding-top'))||0;
 }
 function visibleRow(){
  const top=topEdge()+2;
  const paragraphs=rows();
  let low=0,high=paragraphs.length;
  while(low<high){
   const middle=Math.floor((low+high)/2);
   if(paragraphs[middle].getBoundingClientRect().bottom>top)high=middle;
   else low=middle+1;
  }
  return paragraphs[Math.min(low,paragraphs.length-1)];
 }
 let touchHeld=false,resumeTimer,followingSuspended=false;
 function touchStart(){
  touchHeld=true;followingSuspended=true;clearTimeout(resumeTimer);
 }
 function touchEnd(event){
  if(event.touches.length)return;
  touchHeld=false;clearTimeout(resumeTimer);
  resumeTimer=setTimeout(()=>{followingSuspended=false;if(playing)center();},3000);
 }
 for(const type of ['touchstart','touchend','touchcancel'])win.addEventListener(type,type==='touchstart'?touchStart:touchEnd,{passive:true,...options});
 let drift=0,lastFrame=0;
 function center(time=performance.now()){
  if(!playing||followingSuspended||touchHeld||!current||stopped||doc.hidden||Math.abs((viewport()?.scale||1)-1)>0.01)return;
  const first=pages.querySelector('article'),last=pages.querySelector('article:last-of-type');
  const top=topEdge(),bottom=Math.min(win.innerHeight,dock?.getBoundingClientRect?.().top||win.innerHeight-10);
  if(bottom<=top||!first||!last)return;
  const target=current.getBoundingClientRect(),height=bottom-top;
  const delta=target.top+target.height/2-(top+height/2);
  // Clamp the scroll to the available prose, including at both chapter ends.
  const distance=Math.min(Math.max(0,last.getBoundingClientRect().bottom-bottom),
   Math.max(Math.min(0,first.getBoundingClientRect().top-top),delta));
  if(Math.abs(distance)<1)return;
  const dt=Math.min(50,Math.max(8,time-lastFrame));lastFrame=time;
  const step=playing&&Math.abs(delta)<=height*.15
   ?Math.sign(distance)*Math.min(Math.abs(distance),Math.max(1,Math.abs(distance)*(1-Math.exp(-dt/160))))
   :distance;
  win.scrollBy(0,step);
  if(Math.abs(distance-step)>=1&&!drift)drift=win.requestAnimationFrame(t=>{drift=0;center(t);});
 }
 function select(word){
  if(!word)return;
  current?.classList.remove('reader-current');current=word;current.classList.add('reader-current');
  center();bookmark(current.closest('[data-pid]'),current);
 }
 function pause(){releasePlayback();sequence++;cloud.cancel();narrator.cancel();win.cancelAnimationFrame(drift);drift=0;clearTimeout(tick);playing=false;play.textContent='Play';}
 function schedule(deadline=0){
  sequence++;cloud.cancel();narrator.cancel();clearTimeout(tick);
  if(playing&&current&&aloud){usePlayback();speechStatus.textContent='';
   if(cloudVoices.has(voiceSelect.value)&&!systemFallback){
    const ticket=sequence,preferences=speechSettings(),first=current;
    function* upcoming(){
     let passage=speechPassage(first);
     for(let n=0;n<Math.min(preferences.speechPreload??2,preferences.speechCacheLimit??8,12);n++){
      const last=passage.words.at(-1),word=last&&wordList[wordList.indexOf(last)+1];
      if(!word)return;
      passage=speechPassage(word);yield passage.text;
     }
    }
    void Promise.all([cloud.prepare(),credentials()]).then(([, {region,key}])=>{
     if(ticket===sequence)void cloud.speak(current,voiceSelect.value,rate,region,key,{pitch:voiceTuning(preferences,voiceSelect.value).speechPitch,ahead:upcoming(),deadline});
    }).catch(error=>{if(ticket!==sequence)return;if(error.name==='AbortError')pause();else cloudFailed(error.message);});
    return;
   }
   const speak=()=>narrator.speak(current,voices.find(v=>v.voiceURI===voiceSelect.value)||systemFallback||voices.find(v=>v.localService)||voices[0],rate,voiceTuning(speechSettings(),voiceSelect.value).speechPitch);
   if(deadline>performance.now())tick=setTimeout(speak,deadline-performance.now());else speak();return;}
  if(playing&&current)tick=setTimeout(()=>void step(1,true),60000*[...current.textContent].length/rate);
 }
 async function step(direction,natural=false){
  const ended=performance.now();
  if(!current)return;
  const request=++sequence;clearTimeout(tick);cloud.cancel();narrator.cancel();
  const source=current;
  if(!wordList.includes(source))wordList=Array.from(pages.querySelectorAll('[data-word-index]'));
  let index=wordList.indexOf(source)+direction;
  if(index===wordList.length&&direction===1){await extend();if(request!==sequence||stopped||!enabled||current!==source)return;wordList=Array.from(pages.querySelectorAll('[data-word-index]'));}
  if(!wordList[index]){pause();return;}
  const paragraph=natural&&source.closest('[data-pid]')!==wordList[index].closest('[data-pid]');
  select(wordList[index]);schedule(paragraph?ended+(speechSettings().paragraphDelay||0):0);
 }
 function switchGuide(on,target){
  const start=target||current||visibleRow()?.querySelector('[data-word-index]')||wordList[0];
  enabled=on;toolbar.hidden=!on;toggle.setAttribute('aria-pressed',String(on));toggle.textContent=on?'Disable reading guide':'Enable reading guide';
  pages.classList.toggle('has-reader-guide',on);
  pages.classList.toggle('guided',on);
  if(on){select(start);schedule();}
  else{pause();current?.classList.remove('reader-current');current=null;bookmark(visibleRow());}
 }
 function visibleWord(row){
  if(!row)return null;
  const top=topEdge()+2;
  const words=Array.from(row.querySelectorAll('[data-word-index]'));
  return words.find(word=>{
   const rect=word.getBoundingClientRect();
   return (rect.bottom??rect.top+rect.height)>top;
  })||words.at(-1)||null;
 }
 function track(){
  if(frame)return;
  frame=win.requestAnimationFrame(()=>{
   frame=0;
   if(enabled){
    if(playing&&!drift)center();
    else if(!playing){
     // When playback is paused, the reader follows the *user's* scrolling,
     // not the old guide location. Resuming starts at the visible word.
     const row=visibleRow(),word=visibleWord(row);
     if(word&&word!==current){
      current?.classList.remove('reader-current');
      current=word;current.classList.add('reader-current');
     }
     bookmark(row,word);
    }
   }else bookmark(visibleRow());
  });
 }
 function lookup(word){
  const wasPlaying=playing;
  pause();
  define(word,()=>{
   if(stopped)return;
   if(!enabled){switchGuide(true,word);onPlaybackChange(true,aloud);}else select(word);
   if(aloud||wasPlaying){playing=true;play.textContent='Pause';if(aloud&&!cloudVoices.has(voiceSelect.value))narrator.prepareOutput();schedule();}
  });
 }
 pages.addEventListener('keydown',e=>{
  if(['Enter',' '].includes(e.key)&&e.target.matches('[data-word-index]')){e.preventDefault();lookup(e.target);}
 },options);
 // A single tap toggles unobtrusive reader controls; a second tap on the
 // SAME annotated word within 360ms opens its dictionary. The delayed first
 // tap prevents controls flashing twice when looking up a word on iPhone.
 let tapped=null,tappedAt=0,tapTimer;
 pages.addEventListener('click',e=>{
  const action=e.target.closest?.('[data-guide]')?.dataset.guide;
  if(action==='toggle'){const next=!enabled;if(!next&&aloud){aloud=false;audio.checked=false;refreshVoices();}switchGuide(next);onPlaybackChange(enabled,aloud);if(menu)menu.hidden=true;return;}
  if(action==='play'){if(playing)pause();else{if(!enabled){switchGuide(true);onPlaybackChange(enabled,aloud);}playing=true;play.textContent='Pause';if(aloud&&!cloudVoices.has(voiceSelect.value))narrator.prepareOutput();schedule();}return;}
  if(action==='back'||action==='forward'){void step(action==='back'?-1:1);return;}
  if(action==='slower'||action==='faster'){
   rate=Math.max(10,Math.min(1200,rate+(action==='slower'?-10:10)));
   rateLabel.textContent=rate+' CPM';rateChanged(rate,voiceSelect.value||'');schedule();return;
  }
  if(e.target.closest?.('[data-reader-ui],button,input,select,label,a'))return;
  const word=e.target.closest?.('[data-word-index]');
  if(word){
   const now=Date.now();
   if(tapped===word&&now-tappedAt<360){clearTimeout(tapTimer);tapped=null;tappedAt=0;lookup(word);}
   else{clearTimeout(tapTimer);tapped=word;tappedAt=now;tapTimer=setTimeout(()=>{tapped=null;onTap();},360);}
   return;
  }
  clearTimeout(tapTimer);tapped=null;onTap();
 },options);
 win.addEventListener('scroll',track,{passive:true,...options});
 win.addEventListener('resize',track,options);
 viewport()?.addEventListener('resize',track,options);
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden){pause();}},options);
 rateLabel.textContent=rate+' CPM';
 const paragraphs=Array.from(rows());
 const row=paragraphs.find(r=>r.dataset.pid===position?.id)||paragraphs[0];
 const spans=row?Array.from(row.querySelectorAll('[data-word-index]')):[];
 const resume=(position?.wordIndex!=null?spans[position.wordIndex]:spans.find(w=>+w.dataset.offset>=(position?.offset??0)))||spans[0];
 audio.checked=!!initialAudio;aloud=audio.checked;refreshVoices();
 if((initialGuide||initialAudio||position?.guided)&&resume){
  switchGuide(true,resume);if(position)resume.scrollIntoView?.({block:'center'});
 }
 else if(!position)win.scrollTo?.(0,0);
 else if(row)win.scrollBy(0,row.getBoundingClientRect().top-parseFloat(win.getComputedStyle(pages).getPropertyValue('scroll-padding-top')||0));
 return ()=>{stopped=true;listeners.abort();clearTimeout(resumeTimer);clearTimeout(tapTimer);pause();cloud.dispose();win.cancelAnimationFrame(frame);win.cancelAnimationFrame(drift);};
}
