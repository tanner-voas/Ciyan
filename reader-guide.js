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
 let tick,hold,frame,lastTap=null,press=null,held=false,stopped=false;
 const viewport=()=>win.visualViewport;
 const mid=()=> (viewport()?.offsetTop||0)+(viewport()?.height||win.innerHeight)/2;
 function bookmark(row,word){
  if(row)save(+row.closest('article').dataset.readerNumber,{id:row.dataset.pid,index:+row.dataset.index,
   wordIndex:word?+word.dataset.wordIndex:0,offset:word?+word.dataset.offset:0});
 }
 function topEdge(){
  return Math.max(0,pages.querySelector('.reader-guide-bar').getBoundingClientRect().bottom);
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
 function center(){
  if(!current)return;
  const rect=current.getBoundingClientRect();
  const distance=rect.top+rect.height/2-mid();
  if(Math.abs(distance)>0.9)win.scrollBy(0,distance);
 }
 function select(word){
  if(!word)return;
  current?.classList.remove('reader-current');current=word;current.classList.add('reader-current');
  center();bookmark(current.closest('[data-pid]'),current);
 }
 function pause(){clearTimeout(tick);playing=false;play.textContent='Play';}
 function schedule(){
  clearTimeout(tick);
  if(playing&&current)tick=setTimeout(()=>void step(1),60000*[...current.textContent].length/rate);
 }
 async function step(direction){
  if(!current)return;
  const source=current;
  if(!wordList.includes(source))wordList=Array.from(pages.querySelectorAll('[data-word-index]'));
  let index=wordList.indexOf(source)+direction;
  if(index===wordList.length&&direction===1){await extend();if(stopped||!enabled||current!==source)return;wordList=Array.from(pages.querySelectorAll('[data-word-index]'));}
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
  frame=win.requestAnimationFrame(()=>{frame=0;if(enabled)center();else bookmark(visibleRow());});
 }
 function cancelHold(){clearTimeout(hold);press=null;}
 pages.addEventListener('pointerdown',e=>{
  cancelHold();held=false;
  const word=e.target.closest('[data-word-index]');if(!word||!e.isPrimary||e.button!==0)return;
  press={x:e.clientX,y:e.clientY,word};
  hold=setTimeout(()=>{held=true;lastTap=null;switchGuide(true,word);},3000);
 },options);
 pages.addEventListener('pointermove',e=>{if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>10)cancelHold();},options);
 pages.addEventListener('pointercancel',()=>{cancelHold();lastTap=null;},options);
 pages.addEventListener('pointerup',e=>{
  const word=e.target.closest('[data-word-index]'),valid=press&&press.word===word&&!held;
  cancelHold();if(!valid||!word)return;
  const now=performance.now();
  if(lastTap?.word===word&&now-lastTap.time<=400){lastTap=null;pause();define(word);}
  else lastTap={word,time:now};
 },options);
 pages.addEventListener('contextmenu',e=>{if(e.target.closest('[data-word-index]'))e.preventDefault();},options);
 pages.addEventListener('keydown',e=>{
  if(['Enter',' '].includes(e.key)&&e.target.matches('[data-word-index]')){e.preventDefault();pause();define(e.target);}
 },options);
 pages.addEventListener('click',e=>{
  const action=e.target.closest('[data-guide]')?.dataset.guide;
  if(action==='toggle')switchGuide(!enabled);
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
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden){pause();cancelHold();}},options);
 rateLabel.textContent=rate+' CPM';
 const paragraphs=Array.from(rows());
 const row=paragraphs.find(r=>r.dataset.pid===position?.id)||paragraphs[0];
 const spans=row?Array.from(row.querySelectorAll('[data-word-index]')):[];
 const resume=position?.wordIndex!=null?spans[position.wordIndex]:spans.find(w=>+w.dataset.offset>=position?.offset);
 if(position?.guided&&resume)switchGuide(true,resume);
 else if(row)win.scrollBy(0,row.getBoundingClientRect().top-parseFloat(win.getComputedStyle(pages).getPropertyValue('scroll-padding-top')||0)-pages.querySelector('.reader-guide-bar').offsetHeight);
 return ()=>{stopped=true;listeners.abort();pause();cancelHold();win.cancelAnimationFrame(frame);};
}
