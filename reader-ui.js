import {acceptChapter,validateChapter,readerAnalysis,gradeReader} from './reader-core.js';

export function createReader({state,change,render,esc,modal,toast,applyFonts}){
 let novel='',number=1,mode='review',scope='gate',revealed=false,shown='',busy=false,epoch=0,observer=null,timer=null,pending=null;
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
  <div class="reader-metrics"><span><strong>${a.average.toFixed(2)}</strong>Average / 2.00</span><button data-action="reader-weak"><strong>${a.weak.length}</strong>Below 1.50</button><button data-action="reader-earlier"><strong>${a.earlier.length}</strong>Earlier items due</button></div>
  <p>${c.complete?'Finished reading':c.unlocked||a.ready?'Ready to read':'Study until the average reaches 2.00 and every item reaches 1.50.'}</p>
  ${btn('study','Study chapter')}${btn('read',c.position?'Continue reading':'Read chapter',c.unlocked||a.ready?'':'disabled')}
  <small>Next import · Chapter ${b.chapters.length+1}</small></div>`;
 }
 function study(b,c,a){
  let queue=a.queue;
  if(scope==='earlier')queue=a.earlier;
  if(scope==='weak')queue=a.weak;
  if(scope==='full')queue=readerAnalysis({...state(),settings:{...state().settings,readerGate:'auto'}},b,c).queue;
  if(!queue.includes(shown)){shown=queue[0];revealed=false;}
  const choices=`<label class="reader-scope">Study list<select id="reader-scope">${[['gate','Chapter preparation'],['weak','Below minimum'],['earlier','Earlier items due'],['full','Full chapter']].map(([v,t])=>`<option value="${v}" ${v===scope?'selected':''}>${t}</option>`).join('')}</select></label>`;
  const item=b.items[shown];
  if(!item)return `${choices}<div class="panel stack"><h2>No cards pending in this list</h2>${a.ready||c.unlocked?btn('read','Read chapter'):btn('study','Study chapter')}</div>`;
  return `${choices}<div class="panel stack"><small>${a.earlier.includes(shown)?'Earlier chapter review':'Chapter study'} · ${esc(item.kind)} · Score ${a.score(shown).toFixed(2)}</small>
  <div class="review-hanzi">${esc(item.hanzi)}</div>${revealed?`<div class="review-pinyin">${esc(item.pinyin)}</div><p>${esc(item.english)}</p><div class="review-controls">${['Again','Hard','Good','Easy'].map((x,i)=>`<button class="grade ${x.toLowerCase()}" data-action="reader-grade" data-key="${esc(shown)}" data-grade="${i+1}">${x}</button>`).join('')}</div>`:btn('reveal','Show answer')}
  <small>${a.weak.length} below minimum · Average ${a.average.toFixed(2)} / 2.00</small>
  ${c.unlocked||a.ready?btn('read','Read chapter'):''}</div>`;
 }
 function article(p,a){
  return `<article data-reader-number="${p.number}"><h2>${esc(p.title)}</h2>${p.paragraphs.map((row,index)=>{
   let offset=0;
   return `<p data-pid="${esc(row.id)}" data-index="${index}">${row.tokens.map(t=>{
    if(typeof t==='string'){offset+=t.length;return esc(t);}
    const k=t[0],surface=t[1]??p.items[k].hanzi,start=offset;offset+=surface.length;
    return `<span role="button" tabindex="0" data-action="reader-define" data-key="${esc(k)}" data-offset="${start}" class="${state().settings.readerHighlight&&a.score(k)<1.5?'reader-weak':''}">${esc(surface)}</span>`;
   }).join('')}</p>`;
  }).join('')}${btn('finish','Mark chapter finished',`data-number="${p.number}"`)}</article>`;
 }
 function view(){
  selectBook();
  const b=book(),c=chapter();
  const importBtn=btn('import','Load chapter file');
  if(!b)return `<div class="page-heading"><h1 class="h1">Reader</h1></div><div class="panel stack"><h2>Open your first chapter</h2><p>Choose chapter 1 of a novel to start studying its vocabulary, terms and expressions.</p>${importBtn}</div>`;
  const a=readerAnalysis(state(),b,c);
  const tabs=['review','study','read'].map(x=>btn(x,x[0].toUpperCase()+x.slice(1),x==='read'&&!c.unlocked&&!a.ready?'disabled':`aria-pressed="${mode===x}"`)).join('');
  const p=memory.get(c.digest);
  const body=mode==='study'?study(b,c,a):mode==='read'&&c.unlocked?p?`<div id="reader-pages" tabindex="0" lang="zh-Hans">${article(p,a)}<div id="reader-boundary"></div></div>`:`<div class="panel stack"><h2>Reload chapter ${number}</h2><p>Your bookmark and study records are saved. Choose the chapter file to read its text on this device.</p>${importBtn}</div>`:review(b,c,a);
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
  clearTimeout(timer);const pos=pending;if(!pos)return;
  pending=null;
  const ok=await change(d=>{const b=d.reader?.[pos.novel],c=b?.chapters[pos.number-1];if(c?.digest===pos.digest){c.position=pos.position;b.current=pos.number;}},false);
  if(!ok&&!pending){pending=pos;timer=setTimeout(flush,400);}
 }
 function notePosition(el){
  const box=el.getBoundingClientRect();
  const top=box.top+8;
  const row=Array.from(el.querySelectorAll('[data-pid]')).find(p=>p.getBoundingClientRect().bottom>top);
  if(!row)return;
  const span=Array.from(row.querySelectorAll('[data-offset]')).find(s=>s.getBoundingClientRect().bottom>top);
  const n=Number(row.closest('article').dataset.readerNumber);
  pending={novel,number:n,digest:book().chapters[n-1].digest,position:{id:row.dataset.pid,index:+row.dataset.index,offset:Number(span?.dataset.offset||0)}};
  clearTimeout(timer);timer=setTimeout(flush,250);
 }
 function mount(){
  observer?.disconnect();const token=++epoch;
  const el=document.querySelector('#reader-pages');if(!el)return;
  const b=book(),c=chapter(),pos=c.position;
  if(pos){
   const row=Array.from(el.querySelectorAll('[data-pid]')).find(x=>x.dataset.pid===pos.id);
   const span=row&&Array.from(row.querySelectorAll('[data-offset]')).find(x=>+x.dataset.offset>=pos.offset);
   if(row)el.scrollTop+=(span||row).getBoundingClientRect().top-el.getBoundingClientRect().top-8;
  }
  el.addEventListener('scroll',()=>notePosition(el),{passive:true});
  let next=number+1;
  const edge=el.querySelector('#reader-boundary');
  async function extend(){
   observer?.disconnect();
   const ch=b.chapters[next-1];
   if(!ch){edge.innerHTML=btn('import','Load chapter '+next);return;}
   if(!ch.unlocked){edge.innerHTML=btn('next','Open chapter '+next,`data-number="${next}"`);return;}
   try{
    const p=await cached(ch);
    if(token!==epoch||!el.isConnected)return;
    if(!p){edge.innerHTML=btn('import','Reload chapter '+next);return;}
    edge.insertAdjacentHTML('beforebegin',article(p,readerAnalysis(state(),b,ch)));applyFonts(edge.previousElementSibling);next++;observer.observe(edge);
   }catch(e){toast(e.message);}
  }
  observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))void extend();},{root:el,rootMargin:'160px'});
  observer.observe(edge);
 }
 async function choose(id,n){
  await flush();novel=id;number=n;mode='review';shown='';revealed=false;
  await change(d=>{d.reader[id].current=n;},false);render();
 }
 function pick(){
  const input=document.createElement('input');input.type='file';input.accept='.ciyan,application/json';
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
   }catch(e){toast(e.message);}
  };input.click();
 }
 async function action(name,el){
  if(busy)return;busy=true;
  try{
   if(name==='import'){pick();return;}
   const b=book(),c=chapter();if(!c)return;
   if(name==='define'){const item=b.items[el.dataset.key];modal(el.textContent||item.hanzi,`<p class="review-pinyin">${esc(item.pinyin)}</p><p>${esc(item.english)}</p><small>${esc(item.kind)}</small>`);return;}
   await flush();
   if(name==='next'){await choose(novel,Number(el.dataset.number));return;}
   if(name==='finish'){
    const index=+el.dataset.number-1;
    if(await change(d=>{d.reader[novel].chapters[index].complete=true;},false)){toast('Chapter marked finished.');}
    return;
   }
   if(name==='read'){
    const a=readerAnalysis(state(),b,c);if(!c.unlocked&&!a.ready)return;
    if(!c.unlocked&&!await change(d=>{d.reader[novel].chapters[number-1].unlocked=true;},false))return;
    await cached(c);mode='read';
   }else if(name==='grade'){
    if(!revealed||shown!==el.dataset.key)return;
    const ok=await change(d=>{const book=d.reader[novel];gradeReader(d,book,shown,+el.dataset.grade);const ch=book.chapters[number-1];if(readerAnalysis(d,book,ch).ready)ch.unlocked=true;},false);
    if(ok){shown='';revealed=false;}
   }else if(name==='reveal'){revealed=true;}
   else if(['study','review','weak','earlier'].includes(name)){scope=['weak','earlier'].includes(name)?name:'gate';mode=name==='review'?'review':'study';shown='';revealed=false;}
   render();
  }catch(e){toast(e.message);}finally{busy=false;}
 }
 document.addEventListener('change',e=>{
  if(e.target.id==='reader-scope'){scope=e.target.value;shown='';revealed=false;render();}
  if(e.target.id==='reader-chapter')void choose(novel,+e.target.value);
  if(e.target.id==='reader-novel')void choose(e.target.value,state().reader[e.target.value].current);
 });
 document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.dataset.action==='reader-define'){e.preventDefault();e.target.click();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush();});
 return {view,mount,action,flush,reset(){clearTimeout(timer);pending=null;memory.clear();novel='';number=1;shown='';mode='review';}};
}
