import {voiceTuning} from './reader-speech.js';
import {catalog,downloadChapter} from './chapter-download.js';
import {novelLibrary,registerCustomChapter,matchesRequestedChapter,volumeList,chaptersInVolume,volumeLabel} from './reader-library.js';
import {mountReadingGuide} from './reader-guide.js';
import {acceptChapter,validateChapter,readerAnalysis,pickReaderItem,gradeReader,recordPractice} from './reader-core.js';

function chapterTitle(c){
 return c.title.replace(/^第[〇零一二三四五六七八九十百千万\d]+章\s*/u,'').replace(/[（(][上下][）)]\s*$/u,'').trim();
}
export function chapterLabel(c){
 const title=chapterTitle(c);
 return 'CH'+String(c.number).padStart(4,'0')+(title?' • '+title:'');
}
export function createReader({state,change,render,esc,modal,closeModal,toast,credentials,applyFonts}){
 let novel='',number=1,mode='review',scope='gate',revealed=false,shown='',busy=false,epoch=0,observer=null,timer=null,pending=null;
 let focusWord=null;
 let disposeGuide=null,pendingRate=null,writingPosition=null;
 let chromeVisible=true,requestedUpload=null,attemptedInitial='';
 const sessions=new Map();
 function evidence(){if(!sessions.has(novel))sessions.set(novel,new Map());return sessions.get(novel);}
 const analysis=(s,b,c)=>readerAnalysis(s,b,c,Date.now(),evidence());
 const memory=new Map();
 const contentDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 const cacheName='ciyan-reader-text-v1';
 const cacheKey=d=>new URL('./reader-content/'+d,location.href).href;
 const books=()=>novelLibrary(state());
 const knownMasterDigest=(entry,digest)=>entry?.digest===digest||entry?.previousDigest===digest||entry?.previousDigests?.includes(digest);
 const libraryBook=id=>books().find(b=>b.novel===id);
 const libraryChapter=(id,n)=>libraryBook(id)?.chapters.find(c=>c.number===n);
 const book=()=>state().reader?.[novel];
 const chapter=()=>book()?.chapters[number-1];
 const btn=(action,label,extra='')=>`<button class="btn btn-secondary" data-action="reader-${action}" ${extra}>${esc(label)}</button>`;
 function selectBook(){
  const available=books();
  if(!libraryBook(novel)){novel=Object.keys(state().reader||{})[0]||available.find(x=>x.novel==='panlong')?.novel||available[0]?.novel||'';number=book()?.current||libraryBook(novel)?.chapters[0]?.number||1;}
  if(!libraryChapter(novel,number))number=book()?.current||libraryBook(novel)?.chapters[0]?.number||1;
 }
 async function openHosted(entry){
  if(!entry||entry.source==='custom')throw Error('Unknown hosted chapter.');
  const known=state().reader?.[entry.novel]?.chapters||[];
  const needed=catalog.filter(e=>e.novel===entry.novel&&e.number<=entry.number&&(e.number>known.length||known[e.number-1]?.digest!==e.digest&&knownMasterDigest(e,known[e.number-1]?.digest))).sort((a,b)=>a.number-b.number);
  const imported=[];
  for(const e of needed){
   const bytes=await downloadChapter(e),p=JSON.parse(new TextDecoder().decode(bytes));
   validateChapter(p);
   await (await caches.open(cacheName)).put(cacheKey(e.digest),new Response(bytes));
   imported.push({p,digest:e.digest});
  }
  await flush();
  if(imported.length){
   if(!await change(d=>{for(const {p,digest} of imported)acceptChapter(d,p,digest);},false))return false;
   for(const {p,digest} of imported)memory.set(digest,p);
  }
  return true;
 }
 function showMissing(entry){
  requestedUpload=entry;
  modal('Chapter file needed',`<p>The custom chapter <strong>${esc(chapterLabel(entry))}</strong> from <strong>${esc(libraryBook(entry.novel)?.title||entry.novel)}</strong> (Chapter ${entry.number}) is no longer stored on this device.</p><p class="subtle">Your chapter index, bookmark and study progress are saved in the backup. Reupload the matching Cíyán chapter JSON to restore its reading text.</p><button class="btn btn-primary btn-full" data-action="reader-reupload">Select chapter JSON</button>`);
 }
 async function loadSelection(id,n,{reading=false,automatic=false}={}){
  if(!libraryBook(id))return;
  await flush();novel=id;number=n;shown='';revealed=false;
  const entry=libraryChapter(id,n);
  if(!entry)return;
  try{
   if(entry.source==='master'){
    if(!state().reader?.[id]?.chapters[n-1]||entry.digest!==state().reader[id].chapters[n-1].digest&&knownMasterDigest(entry,state().reader[id].chapters[n-1].digest)){
     try{if(!await openHosted(entry))return;}
     catch(error){const previous=state().reader?.[id]?.chapters[n-1];
      if(!previous||!(await cached(previous)))throw error;
      toast('Using the saved chapter. The update will retry when online.');
     }
    }
    const ch=state().reader?.[id]?.chapters[n-1];
    if(ch)await cached(ch);
   }else{
    const ch=state().reader?.[id]?.chapters[n-1];
    if(!ch||!(await cached(ch))){
     mode='review';render();if(!automatic)showMissing(entry);return;
    }
   }
   const ch=state().reader?.[id]?.chapters[n-1];
   if(ch){await change(d=>{d.reader[id].current=n;},false);mode=reading&&ch.unlocked?'read':'review';}
   else mode='review';
   chromeVisible=true;render();
  }catch(e){toast(e.message);mode='review';render();}
 }
 let vocabGroup='practice',vocabPage=0,vocabChapter='';
 function vocabulary(b,c,a){
  if(vocabChapter!==c.digest){vocabChapter=c.digest;vocabPage=0;vocabGroup='practice';}
  const groups={ready:[],due:[],practice:[]};
  const earlier=new Set(a.earlier.filter(key=>!c.all.includes(key)));
  for(const key of new Set([...c.all,...earlier])){
   if(b.items[key].kind==='grammar')continue;
   const group=a.group(key)===0?'due':a.qualifies(key)?'ready':'practice';
   groups[group].push(key);
  }
  const keys=groups[vocabGroup],pages=Math.max(1,Math.ceil(keys.length/20));
  vocabPage=Math.min(Math.max(0,vocabPage),pages-1);
  const labels={ready:'Ready',due:'Due',practice:'To practice'};
  const tabs=Object.entries(labels).map(([group,label])=>btn('vocab-group',label+' · '+groups[group].length,`data-group="${group}" aria-pressed="${group===vocabGroup}"`)).join('');
  const rows=keys.slice(vocabPage*20,vocabPage*20+20).map(key=>{
   const item=b.items[key];
   return `<button class="list-card reader-vocab-row" data-action="reader-define" data-key="${esc(key)}"><strong lang="zh-Hans">${esc(item.hanzi)}</strong><span>${esc(item.pinyin)}</span><small>${esc(item.english)}${earlier.has(key)?' · Earlier chapter':''}</small></button>`;
  }).join('');
  return `<section class="panel stack"><h2>Chapter vocabulary</h2><div class="reader-tabs">${tabs}</div>${rows||'<p class="subtle">No words in this group.</p>'}
   ${pages>1?`<div class="row">${btn('vocab-prev','Previous',vocabPage?'':'disabled')}<span>${vocabPage+1} / ${pages}</span>${btn('vocab-next','Next',vocabPage+1<pages?'':'disabled')}</div>`:''}</section>`;
 }
 function review(b,c,a){
  return `<div class="panel stack"><h2>Chapter readiness</h2><p>Automatic vocabulary · ${a.keys.length} items · ${a.focus.size} priority terms/grammar (6× weight)</p>
  <div class="reader-metrics"><span><strong>${a.keys.length-a.weak.length} / ${a.keys.length}</strong>Ready</span><button data-action="reader-weak"><strong>${a.weak.length}</strong>Still to practice</button><button data-action="reader-earlier"><strong>${a.earlier.length}</strong>Earlier items due</button></div>
  <p>${c.complete?'Finished reading':c.unlocked||a.ready?'Ready to read':'HSK1–4 is the assumed base; advanced/unknown words and priority focus need a score of 1.50, three Good grades, or one Easy this session.'}</p>
  ${btn('study','Study chapter')}${btn('read',c.position?'Continue reading':'Read chapter',c.unlocked||a.ready?'':'disabled')}
  <small>Next import · Chapter ${b.chapters.length+1}</small></div>${vocabulary(b,c,a)}`;
 }
 function study(b,c,a){
  let queue=a.queue;
  if(scope==='earlier')queue=a.earlier;
  if(scope==='weak')queue=a.weak;
  if(scope==='full')queue=[...new Set([...a.earlier,...a.keys])];
  if(!queue.includes(shown)){shown=pickReaderItem(queue,a);revealed=false;}
  const choices=`<label class="reader-scope">Study list<select id="reader-scope">${[['gate','Auto chapter preparation'],['weak','Still to practice'],['earlier','Earlier items due'],['full','All chapter items']].map(([v,t])=>`<option value="${v}" ${v===scope?'selected':''}>${t}</option>`).join('')}</select></label>`;
  const item=b.items[shown];
  if(!item)return `${choices}<div class="panel stack"><h2>No cards pending in this list</h2>${a.ready||c.unlocked?btn('read','Read chapter'):btn('study','Study chapter')}</div>`;
  return `${choices}<div class="panel stack reader-study-card" data-study-key="${esc(shown)}"><small>${a.earlier.includes(shown)?'Earlier chapter review':'Chapter study'} · ${esc(item.kind)} · Score ${a.score(shown).toFixed(2)}</small>
  <div class="review-hanzi">${esc(item.hanzi)}</div>${revealed?`<div class="review-pinyin">${esc(item.pinyin)}</div><p>${esc(item.english)}</p><div class="review-controls">${['Again','Hard','Good','Easy'].map((x,i)=>`<button class="grade ${x.toLowerCase()}" data-action="reader-grade" data-key="${esc(shown)}" data-grade="${i+1}">${x}</button>`).join('')}</div>`:btn('reveal','Show answer')}
  <small>${a.focus.has(shown)?'Priority focus (6×) · ':''}${['Due review','New item','Early practice · schedule unchanged'][a.group(shown)]} · ${evidence().get(shown)?.goods||0}/3 Good · ${a.weak.length} left to qualify</small>
  ${c.unlocked||a.ready?btn('read','Read chapter'):''}</div>`;
 }
 function article(p,a){
  const later=libraryChapter(novel,p.number+1);
  const complete=book()?.chapters[p.number-1]?.complete;
  return `<article data-reader-number="${p.number}"><h2>${esc(chapterLabel(p))}</h2>${p.paragraphs.map((row,index)=>{
   let offset=0,wordIndex=0;
   return `<p data-pid="${esc(row.id)}" data-index="${index}">${row.tokens.map(t=>{
    if(typeof t==='string'){offset+=t.length;return esc(t);}
    const k=t[0],surface=t[1]??p.items[k].hanzi,start=offset;offset+=surface.length;
    return `<span role="button" tabindex="0" data-word-index="${wordIndex++}" data-key="${esc(k)}" data-offset="${start}" class="${!a.qualifies(k)?'reader-weak':''}" aria-label="${esc(surface)}. Double-tap for dictionary">${esc(surface)}</span>`;
   }).join('')}</p>`;
  }).join('')}<div class="reader-end"><div class="reader-end-label">End of chapter ${p.number}</div><button class="reader-finish-next" data-action="reader-finish-next" data-number="${p.number}">${complete?'Completed · ':''}${later?'Mark complete & next chapter →':'Mark chapter complete ✓'}</button></div></article>`;
 }
 function isReading(){return mode==='read'&&chapter()?.unlocked&&memory.has(chapter().digest);}
 function chapterNavigation(){
  const list=libraryBook(novel)?.chapters||[];
  const position=list.findIndex(c=>c.number===number),previous=list[position-1],next=list[position+1];
  return `<header class="reader-topbar" data-reader-ui><button class="reader-top-btn reader-exit" data-action="reader-exit" aria-label="Exit reader">‹ <span>Library</span></button><nav class="reader-chapter-nav" aria-label="Chapter navigation"><button data-action="reader-previous" ${previous?'':'disabled'} aria-label="Previous chapter">‹</button><span>${position+1} / ${list.length}</span><button data-action="reader-following" ${next?'':'disabled'} aria-label="Next chapter">›</button></nav><button class="reader-top-btn reader-toc-button" data-action="reader-toc" aria-label="Table of contents">☷</button></header>`;
 }
 function readerChrome(){
  const entries=libraryBook(novel)?.chapters||[];
  return `${chapterNavigation()}<aside class="reader-toc-sheet" data-reader-toc hidden data-reader-ui><div class="reader-sheet-head"><strong>Table of contents</strong><button data-action="reader-toc" aria-label="Close contents">×</button></div><div class="reader-toc-list">${entries.map((c,i)=>`${c.volume&&(i===0||entries[i-1].volume!==c.volume)?`<h3 class="reader-volume-heading">${esc(volumeLabel(c.volume,c.volumeTitle))}</h3>`:''}<button data-action="reader-jump" data-number="${c.number}" ${c.number===number?'aria-current="page"':''}><span>${esc(chapterTitle(c))}</span><small>Chapter ${c.number}${book()?.chapters[c.number-1]?.complete?' · Finished':''}</small></button>`).join('')}</div></aside>
  <div class="reader-dock" data-reader-ui><div class="reader-playback" data-guide-controls hidden><div class="reader-transport"><button data-guide="back" aria-label="Previous word">≪</button><button data-guide="play" aria-label="Play or pause guide">Play</button><button data-guide="forward" aria-label="Next word">≫</button><button data-guide="slower" aria-label="Slower">−</button><output></output><button data-guide="faster" aria-label="Faster">+</button></div><div class="reader-audio-line" data-audio-controls hidden><label class="reader-voice">Voice<select data-selected="${esc(state().settings.speechVoice||'')}" data-voice-select aria-label="Mandarin voice"></select></label><small data-speech-status role="status"></small></div></div><button class="reader-more-button" data-action="reader-options" aria-label="More reader settings" aria-expanded="false">···</button></div>
  <aside class="reader-settings-sheet" data-reader-settings-sheet hidden data-reader-ui><div class="reader-sheet-head"><strong>Reading options</strong><button data-action="reader-options" aria-label="Close reading options">×</button></div><button class="btn btn-secondary btn-full" data-guide="toggle" aria-pressed="false">Enable reading guide</button><label class="reader-option"><input type="checkbox" data-guide-audio> Read aloud in Mandarin</label><label class="reader-option"><input type="checkbox" id="reader-highlight-in-book" ${state().settings.readerHighlight?'checked':''}> Underline weak words</label><div class="reader-cloud-config" data-cloud-config hidden><button class="btn btn-secondary" data-action="navigate" data-page="settings" data-section="Speech">Speech settings &amp; credentials</button></div><p class="subtle">Single tap: show/hide controls. Double-tap a word: dictionary.</p></aside>`;
 }
 function view(){
  selectBook();
  const available=books(),lib=libraryBook(novel),entry=libraryChapter(novel,number);
  const b=book(),c=chapter();
  const importBtn=btn('import','Upload chapter JSON');
  const volumes=volumeList(lib),currentVolume=lib?.chapters.find(c=>c.number===number)?.volume??volumes[0]?.number;
  // Volume is solely a chapter picker filter. No volume-specific progress or
  // unlock state is created; chapters remain globally numbered and linear.
  const chapterChoices=volumes.length?chaptersInVolume(lib,currentVolume):lib?.chapters||[];
  const chooser=`<div class="reader-heading"><h1 class="h1">Reader</h1>${importBtn}</div><div class="reader-choices"><label>Novel<select id="reader-novel">${available.map(x=>`<option value="${esc(x.novel)}" ${x.novel===novel?'selected':''}>${esc(x.author)} • ${esc(x.title)}</option>`).join('')}</select></label>${volumes.length?`<label>Volume<select id="reader-volume">${volumes.map(v=>`<option value="${v.number}" ${v.number===currentVolume?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label>`:''}<label>Chapter<select id="reader-chapter">${chapterChoices.map(x=>`<option value="${x.number}" ${x.number===number?'selected':''}>${esc(chapterLabel(x))}</option>`).join('')}</select></label></div>`;
  if(!entry)return `${chooser}<div class="panel stack"><h2>No chapters yet</h2>${importBtn}</div>`;
  if(!b||!c){return `${chooser}<div class="panel stack"><h2>${esc(chapterLabel(entry))}</h2><p>${entry.source==='master'?'Hosted chapter: select it to download and prepare for study.':'Custom chapter: upload its JSON to read it again.'}</p>${btn('open','Open selected chapter')}</div>`;}
  const a=analysis(state(),b,c);
  const tabs=['review','study','read'].map(x=>btn(x,x[0].toUpperCase()+x.slice(1),x==='read'&&!c.unlocked&&!a.ready?'disabled':`aria-pressed="${mode===x}"`)).join('');
  const p=memory.get(c.digest);
  const body=mode==='study'?study(b,c,a):mode==='read'&&c.unlocked?p?`<div id="reader-pages" class="${state().settings.readerHighlight?'show-weak':''} ${chromeVisible?'':'reader-ui-hidden'}">${readerChrome()}${article(p,a)}</div>`:`<div class="panel stack"><h2>Reload ${esc(chapterLabel(c))}</h2><p>Progress is retained but this chapter’s text is not available in the device cache.</p>${btn('open','Restore chapter')}</div>`:review(b,c,a);
  if(isReading())return body;
  return `${chooser}<div class="reader-tabs">${tabs}</div>${body}`;
 }
 async function cached(c){
  if(memory.has(c.digest))return memory.get(c.digest);
  const cache=await caches.open(cacheName);
  let res=await cache.match(cacheKey(c.digest));
  const hosted=catalog.find(e=>e.digest===c.digest);
  if(!res&&hosted){
   try{res=new Response(await downloadChapter(hosted));await cache.put(cacheKey(c.digest),res.clone());}
   catch(e){toast(e.message);return;}
  }
  if(res){const bytes=await res.arrayBuffer();
   if(await contentDigest(bytes)!==c.digest)throw Error('Cached chapter changed. Reload its original file.');
   const p=JSON.parse(new TextDecoder().decode(bytes));validateChapter(p);memory.set(c.digest,p);return p;}
 }
 async function flush(){
  while(writingPosition)await writingPosition;
  clearTimeout(timer);const pos=pending,cpm=pendingRate;if(!pos&&cpm===null)return;
  pendingRate=null;
  pending=null;
  writingPosition=change(d=>{if(cpm){
   const s=d.settings,old=s.speechVoice||'',tuning={...voiceTuning(s,cpm.voice),readerCpm:cpm.rate};
   s.voiceProfiles={...s.voiceProfiles,[old]:voiceTuning(s,old),[cpm.voice]:tuning};
   Object.assign(s,tuning,{speechVoice:cpm.voice});
  }if(!pos)return;const b=d.reader?.[pos.novel],c=b?.chapters[pos.number-1];if(c?.digest===pos.digest){c.position=pos.position;b.current=pos.number;}},false);
  const ok=await writingPosition;writingPosition=null;
  if(!ok){if(pendingRate===null)pendingRate=cpm;if(!pending)pending=pos;timer=setTimeout(flush,400);}
 }
 function unmount(){focusWord=null;disposeGuide?.();disposeGuide=null;observer?.disconnect();epoch++;}
 function toggleChrome(){
  chromeVisible=!chromeVisible;
  document.querySelector('#reader-pages')?.classList.toggle('reader-ui-hidden',!chromeVisible);
  if(!chromeVisible){
   const toc=document.querySelector('[data-reader-toc]'),options=document.querySelector('[data-reader-settings-sheet]');
   if(toc)toc.hidden=true;if(options)options.hidden=true;
  }
 }
 function toggleSheet(selector){
  const el=document.querySelector(selector),other=document.querySelector(selector==='[data-reader-toc]'?'[data-reader-settings-sheet]':'[data-reader-toc]');
  if(!el)return;
  if(other)other.hidden=true;
  el.hidden=!el.hidden;
  document.querySelector('.reader-more-button')?.setAttribute('aria-expanded',String(selector==='[data-reader-settings-sheet]'&&!el.hidden));
 }
 function mount(){
  unmount();
  const el=document.querySelector('#reader-pages');
  if(!el){
   // First visit uses the shipped master index without requiring manual import.
   const entry=libraryChapter(novel,number),token=`${novel}:${number}`;
   if(entry&&token!==attemptedInitial&&(!chapter()||!memory.has(chapter().digest))){
    attemptedInitial=token;
    if(entry.source==='master')void loadSelection(novel,number,{automatic:true});
    else void (async()=>{try{if(!chapter()||!(await cached(chapter())))showMissing(entry);}catch(error){toast(error.message);showMissing(entry);}})();
   }
   return;
  }
  const c=chapter();
  disposeGuide=mountReadingGuide(el,{position:pending?.digest===c.digest?pending.position:c.position,initialRate:pendingRate?.rate??state().settings.readerCpm??120,
   speechSettings:()=>state().settings,credentials:()=>credentials(),voiceChanged:voice=>{pendingRate={voice,rate:voiceTuning(state().settings,voice).readerCpm};return flush();},
   initialGuide:state().settings.readerGuideEnabled===true,initialAudio:state().settings.readerTtsEnabled===true,
   onGuideChange:value=>{void change(d=>{d.settings.readerGuideEnabled=value;},false);},
   onAudioChange:value=>{void change(d=>{d.settings.readerTtsEnabled=value;},false);},
   onTap:toggleChrome,rateChanged:(rate,voice)=>{pendingRate={rate,voice};void flush();},extend:async()=>{},
   define:(word,focus)=>{focusWord=focus;void action('define',word);},
   save:(n,position)=>{
    position.guided=el.classList.contains('guided');
    const ch=book()?.chapters[n-1];if(!ch)return;
    if(!pending&&JSON.stringify(ch.position)===JSON.stringify(position))return;
    const hadPending=!!pending;pending={novel,number:n,digest:ch.digest,position};
    if(!hadPending)timer=setTimeout(flush,350);
   }});
 }
 async function choose(id,n,{reading=false}={}){await loadSelection(id,n,{reading});}
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
    if(!matchesRequestedChapter(p,requestedUpload,digest))
     throw Error(`Wrong chapter. Select ${requestedUpload?.title||'the requested chapter'} (Chapter ${requestedUpload?.number}) from ${libraryBook(requestedUpload?.novel)?.title||requestedUpload?.novel}.`);
    // Stage and validate before writing any text. An interrupted import can only leave an unreferenced cache entry.
    const staged={reader:{[p.novel]:structuredClone(state().reader?.[p.novel])}};
    acceptChapter(staged,p,digest);
    await (await caches.open(cacheName)).put(cacheKey(digest),new Response(bytes));
    await flush();
    if(await change(d=>{acceptChapter(d,p,digest);registerCustomChapter(d,p,digest);},false)){
     memory.set(digest,p);novel=p.novel;number=p.number;mode='review';shown='';revealed=false;attemptedInitial=`${novel}:${number}`;requestedUpload=null;closeModal?.();render();toast('Chapter loaded.');
    }
   }catch(e){toast(e.message);}finally{input.remove?.();}
  };input.click();
 }
 async function action(name,el){
  if(busy)return;busy=true;
  try{
   if(name==='catalog'){
    const file=el.dataset.file||document.querySelector('#reader-catalog-choice')?.value;
    const entry=catalog.find(e=>e.file===file);
    if(entry)await loadSelection(entry.novel,entry.number);return;
   }
   if(name==='focus'){closeModal();const focus=focusWord;focusWord=null;focus?.();return;}
   if(name==='import'){requestedUpload=null;pick();return;}
   if(name==='reupload'){closeModal();pick();return;}
   if(name==='open'){await loadSelection(novel,number);return;}
   if(name==='toc'){toggleSheet('[data-reader-toc]');return;}
   if(name==='options'){toggleSheet('[data-reader-settings-sheet]');return;}
   if(name==='jump'){await choose(novel,Number(el.dataset.number),{reading:true});return;}
   if(name==='previous'||name==='following'){
    const chapters=libraryBook(novel)?.chapters||[];
    const index=chapters.findIndex(c=>c.number===number);
    const target=chapters[index+(name==='previous'?-1:1)];
    if(target)await choose(novel,target.number,{reading:true});return;
   }
   const b=book(),c=chapter();if(!c)return;
   if(name==='vocab-group'||name==='vocab-prev'||name==='vocab-next'){
    if(name==='vocab-group'){vocabGroup=el.dataset.group;vocabPage=0;}
    else vocabPage+=name==='vocab-prev'?-1:1;
    render();return;
   }
   if(name==='define'){
    const item=b.items[el.dataset.key];if(!item)return;
    const match=state().cards.find(card=>card.hanzi===item.hanzi);
    modal(item.hanzi,`<div class="reader-definition"><p class="review-pinyin">${esc(item.pinyin)}</p><p>${esc(item.english)}</p><small>${esc(item.kind)}</small><div class="reader-definition-actions">${focusWord?btn('focus',state().settings.readerTtsEnabled?'Read from here':'Guide from here'):''}<button class="btn btn-secondary" data-action="say-text" data-text="${esc(item.hanzi)}">Listen</button>${match?`<button class="btn btn-secondary" data-action="edit-card" data-id="${esc(match.id)}">Edit word</button>`:''}</div></div>`);return;
   }
   await flush();
   if(name==='exit'){mode='review';chromeVisible=true;render();globalThis.scrollTo?.(0,0);return;}
   if(name==='finish-next'||name==='finish'){
    const index=Number(el.dataset.number)-1;
    if(await change(d=>{d.reader[novel].chapters[index].complete=true;},false))toast('Chapter marked complete.');
    if(name==='finish-next'){
     const later=libraryBook(novel)?.chapters.find(x=>x.number===index+2);
     if(later){await choose(novel,later.number,{reading:true});return;}
     mode='review';render();return;
    }
    return;
   }
   if(name==='read'){
    const a=analysis(state(),b,c);if(!c.unlocked&&!a.ready)return;
    if(!c.unlocked&&!await change(d=>{d.reader[novel].chapters[number-1].unlocked=true;},false))return;
    if(!(await cached(c))){showMissing(libraryChapter(novel,number));return;}
    mode='read';chromeVisible=true;
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
  if(e.target.id==='reader-volume'){
   const destination=chaptersInVolume(libraryBook(novel),Number(e.target.value))[0];
   if(destination)void choose(novel,destination.number);
  }
  if(e.target.id==='reader-chapter')void choose(novel,+e.target.value);
  if(e.target.id==='reader-novel'){
   const id=e.target.value,stored=state().reader?.[id]?.current;
   const selected=libraryBook(id)?.chapters.find(c=>c.number===stored)||libraryBook(id)?.chapters[0];
   if(selected)void choose(id,selected.number);
  }
 });
 globalThis.addEventListener?.('pagehide',()=>void flush());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush();});
 return {view,isReading,mount,unmount,action,flush,reset(){unmount();pendingRate=null;sessions.clear();clearTimeout(timer);pending=null;memory.clear();novel='';number=1;shown='';mode='review';attemptedInitial='';}};
}
