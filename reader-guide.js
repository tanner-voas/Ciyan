import {mandarinVoices,createNarrator} from './reader-speech.js';
// The document scrolls as one reading surface. Word indices count annotated
// words in a paragraph, while offset keeps older character-based bookmarks usable.
export function mountReadingGuide(pages,{position,save,define,rateChanged,initialRate,extend}){
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
 const narrator=createNarrator(win,select,()=>void step(1),reason=>{
  const fallback=voices.find(v=>v.localService);
  if(playing&&!systemFallback&&!voiceSelect.value&&fallback){
   systemFallback=fallback;narrator.speak(current,fallback,rate);return;
  }
  pause();speechStatus.textContent='Mandarin audio could not play ('+reason+'). Check media volume and output, or choose another voice and tap Play.';
 });
 function refreshVoices(){
  voices=mandarinVoices(synth.getVoices());
  const system=doc.createElement('option');system.value='';system.textContent='System Mandarin';
  voiceSelect.replaceChildren(system,...voices.map(v=>{
   const option=doc.createElement('option');option.value=v.voiceURI;option.textContent=v.name+(v.localService?'':' (network)');return option;
  }));
  voiceSelect.value=voices.some(v=>v.voiceURI===voiceSelect.dataset.selected)?voiceSelect.dataset.selected:'';
  voiceSelect.hidden=!aloud||!voices.length;
 }
 if(synth&&win.SpeechSynthesisUtterance){
  refreshVoices();synth.addEventListener?.('voiceschanged',refreshVoices,options);
  audio.addEventListener('click',()=>{aloud=audio.checked;systemFallback=null;refreshVoices();if(aloud&&current){playing=true;play.textContent='Pause';}else releasePlayback();schedule();},options);
  voiceSelect.addEventListener('change',()=>{voiceSelect.dataset.selected=voiceSelect.value;systemFallback=null;schedule();},options);
 }else if(audio?.matches?.('[data-guide-audio]')){
  audio.disabled=true;speechStatus.textContent='This browser does not provide speech playback.';
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
 let drift=0,lastFrame=0;
 function center(time=performance.now()){
  if(!current||stopped||doc.hidden||Math.abs((viewport()?.scale||1)-1)>0.01)return;
  const first=pages.querySelector('article'),last=pages.querySelector('article:last-of-type');
  const top=topEdge(),bottom=Math.min(win.innerHeight,pages.querySelector('.reader-guide-bar').getBoundingClientRect().top);
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
 function pause(){releasePlayback();sequence++;narrator.cancel();win.cancelAnimationFrame(drift);drift=0;clearTimeout(tick);playing=false;play.textContent='Play';}
 function schedule(){
  sequence++;narrator.cancel();clearTimeout(tick);
  if(playing&&current&&aloud){usePlayback();speechStatus.textContent='';narrator.speak(current,voices.find(v=>v.voiceURI===voiceSelect.value)||systemFallback,rate);return;}
  if(playing&&current)tick=setTimeout(()=>void step(1),60000*[...current.textContent].length/rate);
 }
 async function step(direction){
  if(!current)return;
  const request=++sequence;clearTimeout(tick);narrator.cancel();
  const source=current;
  if(!wordList.includes(source))wordList=Array.from(pages.querySelectorAll('[data-word-index]'));
  let index=wordList.indexOf(source)+direction;
  if(index===wordList.length&&direction===1){await extend();if(request!==sequence||stopped||!enabled||current!==source)return;wordList=Array.from(pages.querySelectorAll('[data-word-index]'));}
  if(!wordList[index]){pause();return;}
  select(wordList[index]);schedule();
 }
 function switchGuide(on,target){
  const start=target||current||visibleRow()?.querySelector('[data-word-index]')||wordList[0];
  enabled=on;toolbar.hidden=!on;toggle.setAttribute('aria-expanded',String(on));
  pages.classList.toggle('guided',on);
  if(on){select(start);schedule();}
  else{pause();current?.classList.remove('reader-current');current=null;bookmark(visibleRow());}
 }
 function track(){
  if(frame)return;
  frame=win.requestAnimationFrame(()=>{frame=0;if(enabled){if(playing&&!drift)center();}else bookmark(visibleRow());});
 }
 function lookup(word){
  const wasPlaying=playing;
  pause();
  define(word,enabled?()=>{
   if(stopped||!enabled)return;
   select(word);
   if(wasPlaying){playing=true;play.textContent='Pause';schedule();}
  }:null);
 }
 pages.addEventListener('keydown',e=>{
  if(['Enter',' '].includes(e.key)&&e.target.matches('[data-word-index]')){e.preventDefault();lookup(e.target);}
 },options);
 pages.addEventListener('click',e=>{
  const word=e.target.closest('[data-word-index]');
  if(word){lookup(word);return;}
  const action=e.target.closest('[data-guide]')?.dataset.guide;
  if(action==='toggle'){if(!enabled&&synth&&win.SpeechSynthesisUtterance)refreshVoices();switchGuide(!enabled);}
  if(action==='play'){if(playing)pause();else{playing=true;play.textContent='Pause';schedule();}}
  if(action==='back'||action==='forward')void step(action==='back'?-1:1);
  if(action==='slower'||action==='faster'){
   rate=Math.max(10,Math.min(1200,rate+(action==='slower'?-10:10)));
   rateLabel.textContent=rate+' CPM';rateChanged(rate);schedule();
  }
 },options);
 win.addEventListener('scroll',track,{passive:true,...options});
 win.addEventListener('resize',track,options);
 viewport()?.addEventListener('resize',track,options);
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden){pause();}},options);
 rateLabel.textContent=rate+' CPM';
 const paragraphs=Array.from(rows());
 const row=paragraphs.find(r=>r.dataset.pid===position?.id)||paragraphs[0];
 const spans=row?Array.from(row.querySelectorAll('[data-word-index]')):[];
 const resume=position?.wordIndex!=null?spans[position.wordIndex]:spans.find(w=>+w.dataset.offset>=position?.offset);
 if(position?.guided&&resume)switchGuide(true,resume);
 else if(!position)win.scrollTo?.(0,0);
 else if(row)win.scrollBy(0,row.getBoundingClientRect().top-parseFloat(win.getComputedStyle(pages).getPropertyValue('scroll-padding-top')||0));
 return ()=>{stopped=true;listeners.abort();pause();win.cancelAnimationFrame(frame);win.cancelAnimationFrame(drift);};
}
