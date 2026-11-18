import {mountReadingGuide} from './reader-guide.js';
import {acceptChapter,validateChapter,readerAnalysis,gradeReader,recordPractice} from './reader-core.js';

export function createReader({state,change,render,esc,modal,toast,applyFonts}){
 let novel='',number=1,mode='review',scope='gate',revealed=false,shown='',busy=false,epoch=0,observer=null,timer=null,pending=null;
 let disposeGuide=null,pendingRate=null,writingPosition=null;
 const sessions=new Map();
 function evidence(){if(!sessions.has(novel))sessions.set(novel,new Map());return sessions.get(novel);}
 const analysis=(s,b,c)=>readerAnalysis(s,b,c,Date.now(),evidence());
 const memory=new Map();
 const contentDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 const cacheName='ciyan-reader-text-v1';
 const cacheKey=d=>new URL('./reader-content/'+d,location.href).href;
 const book=()=>state().reader?.[novel];
 const chapter=()=>book()?.chapters[number-1];
 const btn=(action,label,extra='')=>`<button class="btn btn-secondary" data-action="reader-${action}" ${extra}>${esc(label)}</button>`;
 function selectBook(){
  if(!book()){novel=Object.keys(state().reader||{})[0]||'';number=book()?.current||1;}
  if(!chapter())number=book()?.current||1;
 }
 function review(b,c,a){
  return `<div class="panel stack"><h2>Chapter readiness</h2><p>${state().settings.readerGate==='auto'?'All words and terms':'Authored study list'} · ${a.keys.length} items</p>
  <div class="reader-metrics"><span><strong>${a.keys.length-a.weak.length} / ${a.keys.length}</strong>Ready</span><button data-action="reader-weak"><strong>${a.weak.length}</strong>Still to practice</button><button data-action="reader-earlier"><strong>${a.earlier.length}</strong>Earlier items due</button></div>
  <p>${c.complete?'Finished reading':c.unlocked||a.ready?'Ready to read':'Each item needs a saved score of 1.50, three Good grades, or one Easy this session.'}</p>
  ${btn('study','Study chapter')}${btn('read',c.position?'Continue reading':'Read chapter',c.unlocked||a.ready?'':'disabled')}
  <small>Next import · Chapter ${b.chapters.length+1}</small></div>`;
 }
 function study(b,c,a){
  let queue=a.queue;
  if(scope==='earlier')queue=a.earlier;
  if(scope==='weak')queue=a.weak;
  if(scope==='full')queue=analysis({...state(),settings:{...state().settings,readerGate:'auto'}},b,c).queue;
  if(!queue.includes(shown)){shown=queue[0];revealed=false;}
  const choices=`<label class="reader-scope">Study list<select id="reader-scope">${[['gate','Chapter preparation'],['weak','Still to practice'],['earlier','Earlier items due'],['full','Full chapter']].map(([v,t])=>`<option value="${v}" ${v===scope?'selected':''}>${t}</option>`).join('')}</select></label>`;
  const item=b.items[shown];
  if(!item)return `${choices}<div class="panel stack"><h2>No cards pending in this list</h2>${a.ready||c.unlocked?btn('read','Read chapter'):btn('study','Study chapter')}</div>`;
  return `${choices}<div class="panel stack reader-study-card" data-study-key="${esc(shown)}"><small>${a.earlier.includes(shown)?'Earlier chapter review':'Chapter study'} · ${esc(item.kind)} · Score ${a.score(shown).toFixed(2)}</small>
  <div class="review-hanzi">${esc(item.hanzi)}</div>${revealed?`<div class="review-pinyin">${esc(item.pinyin)}</div><p>${esc(item.english)}</p><div class="review-controls">${['Again','Hard','Good','Easy'].map((x,i)=>`<button class="grade ${x.toLowerCase()}" data-action="reader-grade" data-key="${esc(shown)}" data-grade="${i+1}">${x}</button>`).join('')}</div>`:btn('reveal','Show answer')}
  <small>${['Due review','New item','Early practice · schedule unchanged'][a.group(shown)]} · ${evidence().get(shown)?.goods||0}/3 Good · ${a.weak.length} left to qualify</small>
  ${c.unlocked||a.ready?btn('read','Read chapter'):''}</div>`;
 }
 function article(p,a){
  return `<article data-reader-number="${p.number}">${btn('exit','Exit reader',`data-number="${p.number}"`)}<h2>${esc(p.title)}</h2>${p.paragraphs.map((row,index)=>{
   let offset=0,wordIndex=0;
   return `<p data-pid="${esc(row.id)}" data-index="${index}">${row.tokens.map(t=>{
    if(typeof t==='string'){offset+=t.length;return esc(t);}
    const k=t[0],surface=t[1]??p.items[k].hanzi,start=offset;offset+=surface.length;
    return `<span role="button" tabindex="0" data-word-index="${wordIndex++}" data-key="${esc(k)}" data-offset="${start}" class="${a.score(k)<1.5?'reader-weak':''}">${esc(surface)}</span>`;
   }).join('')}</p>`;
  }).join('')}${btn('finish','Mark chapter finished',`data-number="${p.number}"`)}${btn('exit','Exit reader',`data-number="${p.number}"`)}</article>`;
 }
 function isReading(){return mode==='read'&&chapter()?.unlocked&&memory.has(chapter().digest);}
 function view(){
  selectBook();
  const b=book(),c=chapter();
  const importBtn=btn('import','Load chapter file');
  if(!b)return `<div class="page-heading"><h1 class="h1">Reader</h1></div><div class="panel stack"><h2>Open your first chapter</h2><p>Choose chapter 1 of a novel to start studying its vocabulary, terms and expressions.</p>${importBtn}</div>`;
  const a=analysis(state(),b,c);
  const tabs=['review','study','read'].map(x=>btn(x,x[0].toUpperCase()+x.slice(1),x==='read'&&!c.unlocked&&!a.ready?'disabled':`aria-pressed="${mode===x}"`)).join('');
  const p=memory.get(c.digest);
  const body=mode==='study'?study(b,c,a):mode==='read'&&c.unlocked?p?`<div id="reader-pages" class="${state().settings.readerHighlight?'show-weak':''}"><details class="reader-guide-bar"><summary aria-label="Reader controls" title="Reader controls"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 7h5m4 0h9M3 17h10m4 0h4"/><circle cx="10" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg></summary><div class="reader-menu"><button class="btn btn-secondary" data-guide="toggle" aria-expanded="false">Reading guide</button><div data-guide-controls hidden><button data-guide="back" aria-label="Previous word">≪</button><button data-guide="play">Play</button><button data-guide="forward" aria-label="Next word">≫</button><button data-guide="slower" aria-label="Decrease reading speed">−</button><output></output><button data-guide="faster" aria-label="Increase reading speed">+</button></div><div class="reader-audio"><label><input type="checkbox" data-guide-audio> Read aloud in Mandarin</label><select data-voice-select aria-label="Mandarin voice" hidden></select><small data-speech-status role="status"></small></div><label><input type="checkbox" id="reader-highlight-in-book" ${state().settings.readerHighlight?'checked':''}> Underline weak words</label>${btn('exit','Exit reader')}</div></details>${article(p,a)}<div id="reader-boundary"></div></div>`:`<div class="panel stack"><h2>Reload chapter ${number}</h2><p>Your bookmark and study records are saved. Choose the chapter file to read its text on this device.</p>${importBtn}</div>`:review(b,c,a);
  if(isReading())return body;
  return `<div class="reader-heading"><h1 class="h1">Reader</h1>${importBtn}</div><div class="reader-choices"><label>Novel<select id="reader-novel">${Object.entries(state().reader).map(([k,v])=>`<option value="${esc(k)}" ${k===novel?'selected':''}>${esc(v.title)}</option>`).join('')}</select></label><label>Chapter<select id="reader-chapter">${b.chapters.map(ch=>`<option value="${ch.number}" ${ch.number===number?'selected':''}>${esc(ch.title)}</option>`).join('')}</select></label></div><div class="reader-tabs">${tabs}</div>${body}`;
 }
 async function cached(c){
  if(memory.has(c.digest))return memory.get(c.digest);
  const res=await (await caches.open(cacheName)).match(cacheKey(c.digest));
  if(res){const bytes=await res.arrayBuffer();
   if(await contentDigest(bytes)!==c.digest)throw Error('Cached chapter changed. Reload its original file.');
   const p=JSON.parse(new TextDecoder().decode(bytes));validateChapter(p);memory.set(c.digest,p);return p;}
 }
 async function flush(){
  while(writingPosition)await writingPosition;
  clearTimeout(timer);const pos=pending,cpm=pendingRate;if(!pos&&cpm===null)return;
  pendingRate=null;
  pending=null;
  writingPosition=change(d=>{if(cpm!==null)d.settings.readerCpm=cpm;if(!pos)return;const b=d.reader?.[pos.novel],c=b?.chapters[pos.number-1];if(c?.digest===pos.digest){c.position=pos.position;b.current=pos.number;}},false);
  const ok=await writingPosition;writingPosition=null;
  if(!ok){if(pendingRate===null)pendingRate=cpm;if(!pending)pending=pos;timer=setTimeout(flush,400);}
 }
 function unmount(){disposeGuide?.();disposeGuide=null;observer?.disconnect();epoch++;}
 function mount(){
  unmount();const token=epoch;
  const el=document.querySelector('#reader-pages');if(!el)return;
  const b=book(),c=chapter();
  let next=number+1;
  const edge=el.querySelector('#reader-boundary');
  let loading;
  function extend(){return loading??=appendNext().finally(()=>{loading=null;});}
  async function appendNext(){
   observer?.disconnect();
   const ch=b.chapters[next-1];
   if(!ch){edge.innerHTML=btn('import','Load chapter '+next);return;}
   if(!ch.unlocked){edge.innerHTML=btn('next','Open chapter '+next,`data-number="${next}"`);return;}
   try{
    const p=await cached(ch);
    if(token!==epoch||!el.isConnected)return;
    if(!p){edge.innerHTML=btn('import','Reload chapter '+next);return;}
    edge.insertAdjacentHTML('beforebegin',article(p,analysis(state(),b,ch)));applyFonts(edge.previousElementSibling);next++;observer.observe(edge);
   }catch(e){toast(e.message);}
  }
  observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))void extend();},{rootMargin:'200px'});
  observer.observe(edge);
  disposeGuide=mountReadingGuide(el,{position:c.position,initialRate:pendingRate??state().settings.readerCpm??120,rateChanged:value=>{pendingRate=value;void flush();},extend,
   define:word=>void action('define',word),
   save:(n,position)=>{
    position.guided=el.classList.contains('guided');
    const ch=book()?.chapters[n-1];if(!ch)return;
    if(!pending&&JSON.stringify(ch.position)===JSON.stringify(position))return;
    const hadPending=!!pending;pending={novel,number:n,digest:ch.digest,position};
    if(!hadPending)timer=setTimeout(flush,350);
   }});
 }
 async function choose(id,n){
  await flush();novel=id;number=n;mode='review';shown='';revealed=false;
  await change(d=>{d.reader[id].current=n;},false);render();
 }
 function pick(){
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
  input.hidden=true;document.body?.append(input);
  input.oncancel=()=>input.remove?.();
  input.onchange=async()=>{
   try{
    const file=input.files[0];if(!file)return;
    if(file.size>8*1024*1024)throw Error('Chapter exceeds 8 MiB');
    const bytes=await file.arrayBuffer(),p=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    const digest=await contentDigest(bytes);
    validateChapter(p);
    // Stage and validate before writing any text. An interrupted import can only leave an unreferenced cache entry.
    const staged={reader:{[p.novel]:structuredClone(state().reader?.[p.novel])}};
    acceptChapter(staged,p,digest);
    await (await caches.open(cacheName)).put(cacheKey(digest),new Response(bytes));
    await flush();
    if(await change(d=>acceptChapter(d,p,digest),false)){
     memory.clear();memory.set(digest,p);novel=p.novel;number=p.number;mode='review';shown='';revealed=false;render();toast('Chapter loaded.');
    }
   }catch(e){toast(e.message);}finally{input.remove?.();}
  };input.click();
 }
 async function action(name,el){
  if(busy)return;busy=true;
  try{
   if(name==='import'){pick();return;}
   const b=book(),c=chapter();if(!c)return;
   if(name==='define'){const item=b.items[el.dataset.key];modal(el.textContent||item.hanzi,`<p class="review-pinyin">${esc(item.pinyin)}</p><p>${esc(item.english)}</p><small>${esc(item.kind)}</small>`);return;}
   await flush();
   if(name==='exit'){await choose(novel,Number(el.dataset.number)||book().current);globalThis.scrollTo?.(0,0);return;}
   if(name==='next'){await choose(novel,Number(el.dataset.number));return;}
   if(name==='finish'){
    const index=+el.dataset.number-1;
    if(await change(d=>{d.reader[novel].chapters[index].complete=true;},false)){toast('Chapter marked finished.');}
    return;
   }
   if(name==='read'){
    const a=analysis(state(),b,c);if(!c.unlocked&&!a.ready)return;
    if(!c.unlocked&&!await change(d=>{d.reader[novel].chapters[number-1].unlocked=true;},false))return;
    await cached(c);mode='read';
   }else if(name==='grade'){
    if(!revealed||shown!==el.dataset.key)return;
    const grade=Number(el.dataset.grade),now=Date.now(),session=evidence();
    const trial=new Map(session);recordPractice(trial,shown,grade);
    const early=readerAnalysis(state(),b,c,now,session).group(shown)===2;
    const unlock=!c.unlocked&&readerAnalysis(state(),b,c,now,trial).ready;
    if(!early||unlock){
     const ok=await change(d=>{
      const book=d.reader[novel],ch=book.chapters[number-1];
      if(!early)gradeReader(d,book,shown,grade,now);
      if(!ch.unlocked&&readerAnalysis(d,book,ch,now,trial).ready)ch.unlocked=true;
     },false);
     if(!ok)return;
    }
    session.set(shown,trial.get(shown));shown='';revealed=false;
   }else if(name==='reveal'){revealed=true;}
   else if(['study','review','weak','earlier'].includes(name)){scope=['weak','earlier'].includes(name)?name:'gate';mode=name==='review'?'review':'study';shown='';revealed=false;}
   render();
  }catch(e){toast(e.message);}finally{busy=false;}
 }
 document.addEventListener('change',async e=>{
  if(e.target.id==='reader-highlight-in-book'){
   const checked=e.target.checked;await flush();
   if(await change(d=>{d.settings.readerHighlight=checked;},false))document.querySelector('#reader-pages')?.classList.toggle('show-weak',checked);
   else e.target.checked=state().settings.readerHighlight;
  }
  if(e.target.id==='reader-scope'){scope=e.target.value;shown='';revealed=false;render();}
  if(e.target.id==='reader-chapter')void choose(novel,+e.target.value);
  if(e.target.id==='reader-novel')void choose(e.target.value,state().reader[e.target.value].current);
 });
 globalThis.addEventListener?.('pagehide',()=>void flush());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush();});
 return {view,isReading,mount,unmount,action,flush,reset(){unmount();pendingRate=null;sessions.clear();clearTimeout(timer);pending=null;memory.clear();novel='';number=1;shown='';mode='review';}};
}
