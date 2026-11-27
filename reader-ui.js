import {captureUsage,profileTranslationFetch} from './shared/google-drive/src/profile-usage.js';
import {translate,clearTranslationCache,getTranslationDiagnostics,clearTranslationDiagnostics} from './translation.js';
import {shareFile} from './share-files.js';
import {AID_LABELS,aidLevel,aidSettings,updateAidDisplay,struggleThreshold} from './reader-assistance.js';
import {editionId,editionState,writeEditionState,paragraphId,scopedPosition,resumeEditionChapter,rememberEditionChapter,preserveLegacyEditionCursor,selectEditionPrefs,EDITIONS} from './reader-edition-state.js';
import {offlineRequest} from './reader-offline.js';
import {deriveEdition,learnerIndex,synonymRange} from './reader-editions.js';
import {normalizeBoundaries} from './reader-boundaries.js';
import {voiceTuning} from './reader-speech.js';
import {catalog,downloadChapter} from './chapter-download.js';
import {novelLibrary,registerCustomChapter,matchesRequestedChapter,volumeList,chaptersInVolume,volumeLabel} from './reader-library.js';
import {mountReadingGuide} from './reader-guide.js';
import {acceptChapter,validateChapter,importChapterLexicon,readerAnalysis,pickReaderItem,gradeReader,recordPractice,readerGradePreview} from './reader-core.js';
import {newVocabRemaining} from './study-engine.js';
import {intervalText} from './review-scheduler.js';
import {dueCompletion,studyProgressForState} from './study-progress.js';

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
 const paragraphTranslations=new Map();
 const translationBadge='./reader-assets/google-translate-attribution.png';
 const enforceTranslationAttribution=true;
 function showTranslation(target,text){
  target.textContent=text;const link=document.createElement('a');link.href='https://translate.google.com/';link.target='_blank';link.rel='noopener noreferrer';const img=document.createElement('img');img.src=translationBadge;img.alt='Powered by Google Translate';img.addEventListener('error',()=>{link.textContent='Powered by Google Translate';},{once:true});link.append(img);target.append(link);target.hidden=false;
 }
 async function requireTranslationBadge(){const response=await fetch(translationBadge);if(!response.ok||!response.headers.get('Content-Type')?.startsWith('image/'))throw Error('Translation setup incomplete: install the official Google attribution badge.');}
 let pendingPlayback=null;
 let disposeGuide=null,pendingRate=null,writingPosition=null;
 let chromeVisible=true,requestedUpload=null,attemptedInitial='',quotaDialogShownFor='';
 const sessions=new Map(),chapterDueSnapshots=new Map();
 function evidence(){const key=`${novel}:${chapter()?.digest||number}`;if(!sessions.has(key))sessions.set(key,new Map());return sessions.get(key);}
 const analysis=(s,b,c)=>readerAnalysis(s,b,c,Date.now());
 const memory=new Map();
 function parseText(bytes){
  const raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));validateChapter(raw);
  return normalizeBoundaries(raw,state());
 }
 const contentDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 const cacheName='ciyan-reader-text-v1';
 const cacheKey=d=>new URL('./reader-content/'+d,location.href).href;
 const books=()=>novelLibrary(state());
 const knownMasterDigest=(entry,digest)=>!!digest&&(entry?.digest===digest||entry?.previousDigest===digest||entry?.previousDigests?.includes(digest));
 const libraryBook=id=>books().find(b=>b.novel===id);
 const libraryChapter=(id,n)=>libraryBook(id)?.chapters.find(c=>c.number===n);
 const editionEntries=(id,edition)=>(libraryBook(id)?.chapters||[]).filter(c=>edition==='original'||(edition==='hsk4'?c.gradedHsk4File:edition==='hsk5'?c.gradedHsk5File:c.gradedFile));
 const resumeChapter=(id,edition)=>resumeEditionChapter(state().reader?.[id],edition,editionEntries(id,edition));
 const activeBookEdition=id=>{const b=state().reader?.[id];return b?.activeEdition||selectedEdition(b?.chapters?.[b?.current-1]?.editionPrefs);};
 const gradedAssets=new Map();
 let activeView=null,preview=null;
 const prefs=()=>chapter()?.editionPrefs||{};
 // A legacy graded=true preference means HSK6. Explicit HSK5 selection is
 // opt-in and survives switching away to Original, without resetting progress.
 const selectedEdition=editionId;
 const currentEdition=()=>needsChapterUpdate()?'original':selectedEdition(prefs());
 const gradedEntry=()=>catalog.find(e=>e.novel===novel&&e.number===number&&e.gradedFile&&knownMasterDigest(e,chapter()?.digest));
 const needsChapterUpdate=()=>{const e=libraryChapter(novel,number),c=chapter();return !!(e?.source==='master'&&c&&e.digest!==c.digest&&knownMasterDigest(e,c.digest));};
 let selectionLoading=false;
 const hasGraded=()=>!!gradedEntry();
 const sourceBook=()=>state().reader?.[novel];
 const chapter=()=>sourceBook()?.chapters[number-1];
 const projection=()=>activeView?.digest===chapter()?.digest?activeView:null;
 const book=()=>{
  const b=sourceBook(),v=projection();return b&&v?{...b,items:{...b.items,...v.p.items}}:b;
 };
 const studyChapter=()=>{const c=chapter(),v=projection();return c&&v?{...c,all:v.all,focus:v.p.focus??c.focus}:c;};
 function editionSelector(){
  if(!hasGraded())return '';
  const current=needsChapterUpdate()?'original':selectedEdition(prefs());
  return `<label>Edition<select id="reader-edition"><option value="original" ${current==='original'?'selected':''}>Original</option><option value="hsk4" ${current==='hsk4'?'selected':''}>HSK4 + TSK8</option><option value="hsk5" ${current==='hsk5'?'selected':''}>HSK5 + TSK10</option><option value="graded" ${current==='graded'?'selected':''}>HSK6 + TSK12</option></select></label>${needsChapterUpdate()?`<p class="subtle">A newer chapter edition is available. ${btn('open','Update chapter')}</p>`:''}`;
 }
 function autoControl(){
  const p=prefs();return '<div class="reader-editions">'+btn('auto',p.auto?'Auto · '+Number(p.minimum??.92).toFixed(2):'Auto simplify')+'</div>';
 }
 async function baseEdition(original,selection){
  if(selection==='original')return original;
  const entry=gradedEntry();
  if(!entry||entry.digest!==chapter()?.digest)throw Error('Update this chapter before opening its graded edition.');
  const file=selection==='hsk4'?entry.gradedHsk4File:selection==='hsk5'?entry.gradedHsk5File:entry.gradedFile;
  if(!file)throw Error('This chapter has no matching graded edition.');
  const digest=chapter().digest,key=digest+':'+selection;
  if(!gradedAssets.has(key)){
   const {default:asset}=await import('./chapters/'+file);
   if(asset.sourceDigest!==digest||asset.paragraphs.length!==original.paragraphs.length||
    !asset.paragraphs.every((r,i)=>r.id===original.paragraphs[i].id))throw Error('This edition requires its matching original.');
   validateChapter({...original,...asset});
   gradedAssets.set(key,asset);
  }
  return {...original,...gradedAssets.get(key),graded:true};
 }
 function compute(base,index,minimum,restored,threshold=struggleThreshold(state().settings)){
  return deriveEdition(base,index,minimum,{restore:new Set(restored),threshold,termScore:key=>sourceBook()?.progress[key]?.score||0});
 }
 function installView(p,result,digest){
  const text=result?.p||p;
  const changed=new Map();
  for(const [loc,c] of result?.changes||[])for(let i=c.start;i<c.end;i++)changed.set(c.row+':'+i,loc);
  activeView={p:text,digest,result,changed,all:[...new Set([...text.paragraphs.flatMap(r=>r.tokens.filter(Array.isArray).map(t=>t[0])),...(text.nestedTerms||[])])]};
  shown='';revealed=false;vocabPage=0;chapterDueSnapshots.clear();
 }
 async function reopenView(){
  activeView=null;const c=chapter(),pref=prefs(),original=memory.get(c?.digest);
  if(!original||(!pref.graded&&!pref.auto))return;
  const base=await baseEdition(original,needsChapterUpdate()?'original':selectedEdition(pref));
  if(c.digest!==chapter()?.digest)return;
  if(base.graded&&Object.keys(base.items).some(k=>!sourceBook().items[k])){
   if(!await change(d=>{importChapterLexicon(d,base);const b=d.reader[novel];b.items={...b.items,...base.items};},false,true))throw Error('Could not save graded vocabulary. Reopen this chapter to retry.');
  }
  installView(base,pref.auto?compute(base,learnerIndex(state()),pref.minimum??.92,pref.restored):null,c.digest);
 }
 const fmt=v=>v==null?'—':v.toFixed(2);
 const ratio=(n,d)=>d?(100*n/d).toFixed(1)+'%':'—';
 function previewStats(result){
  const s=result.stats,changed=result.changes.size;
  return '<p><strong>'+['Ready','Some study may help','Frequent lookups or looser wording','Substantial difficulty or meaning risk'][s.tier]+'</strong></p>'+
   '<p>Replaced '+changed+' / '+s.total+' word occurrences ('+ratio(changed,s.total)+'), including '+changed+' / '+s.eligible+' unfamiliar occurrences ('+ratio(changed,s.eligible)+').</p>'+
   '<p>Mean chapter mastery '+fmt(s.before)+' → <strong>'+fmt(s.after)+'</strong>. Mean synonym score '+fmt(s.strength)+' ('+s.count+' replacements). Minimum '+fmt(s.min)+' · distinct-pair mean '+fmt(s.pairMean)+' · below 0.90 '+ratio(s.low,s.count)+'.</p>'+
   '<p>Unfamiliar vocabulary '+s.unresolved.size+' distinct · '+s.unknown+' / '+s.displayed+' occurrences ('+ratio(s.unknown,s.displayed)+'). Unfamiliar terms '+s.terms.size+'.</p>'+
   '<details><summary>Remaining words and skipped alternatives</summary><p lang="zh-Hans">'+[...s.unresolved].sort((a,b)=>b[1]-a[1]).map(([w,n])=>esc(w)+' ×'+n).join('、')+'</p><p>Missing edge '+s.denied.missing+' · context '+s.denied.context+' · score '+s.denied.threshold+' · below mastery threshold '+s.denied.unfamiliar+'.</p></details>';
 }
 async function openAuto(original){
  const c=chapter(),pref=prefs(),base=await baseEdition(original,needsChapterUpdate()?'original':selectedEdition(pref)),index=learnerIndex(state());
  const restore=pref.restored||[];
  let threshold=struggleThreshold(state().settings),range=synonymRange(base,index,threshold,new Set(restore));
  const clamp=(v,r)=>Math.max(r.min,Math.min(r.max,v));
  let preferred=pref.minimum??(range.available?range.max:1),minimum=clamp(preferred,range);
  preview={digest:c.digest,base,index,restore,minimum,threshold,result:compute(base,index,minimum,restore,threshold)};
  modal('Auto simplify',`<label>Minimum synonym score <output id="reader-min-score">${minimum.toFixed(2)}</output><input aria-label="Minimum synonym score" style="width:100%" id="reader-score-slider" type="range" min="${range.min}" max="${range.max}" step="any" value="${minimum}" ${range.min===range.max?'disabled':''}></label><small id="reader-score-range"></small><label>Struggle threshold (global) <output id="reader-auto-threshold">${threshold.toFixed(1)}</output><input aria-label="Struggle threshold" style="width:100%" id="reader-threshold-slider" type="range" min="0" max="3" step="0.1" value="${threshold}"></label><p class="subtle">Dictionary synonyms may change meaning in context. Apply saves both settings.</p><div id="reader-preview" aria-live="polite">${previewStats(preview.result)}</div><div class="row">${btn('auto-apply',pref.auto?'Refresh and apply':'Apply to this edition')}${pref.auto?btn('auto-off','Turn Auto off'):''}</div>`);
  const slider=document.querySelector('#reader-score-slider'),struggle=document.querySelector('#reader-threshold-slider');
  const update=()=>{
   if(!slider.isConnected||preview?.digest!==c.digest)return;
   const next=Number(struggle.value);
   if(next!==threshold){threshold=next;range=synonymRange(base,index,threshold,new Set(restore));slider.min=range.min;slider.max=range.max;slider.disabled=range.min===range.max;slider.value=clamp(preferred,range);}
   minimum=Number(slider.value);preview.minimum=minimum;preview.threshold=threshold;
   preview.result=compute(base,index,minimum,restore,threshold);
   document.querySelector('#reader-min-score').textContent=minimum.toFixed(2);
   document.querySelector('#reader-auto-threshold').textContent=threshold.toFixed(1);
   document.querySelector('#reader-score-range').textContent=range.available?`${range.min.toFixed(2)} – ${range.max.toFixed(2)}`:'No known alternatives at this threshold';
   document.querySelector('#reader-preview').innerHTML=previewStats(preview.result);
  };
  slider.oninput=()=>{preferred=Number(slider.value);update();};struggle.oninput=update;preview.update=update;update();
 }
 async function saveEdition(pref,base,result,digest,threshold){
  if(!await flush())return;
  if(chapter()?.digest!==digest)return;
  unmount();
  if(!await change(d=>{
   if(threshold!==undefined)d.settings.readerStruggleThreshold=threshold;
   const b=d.reader[novel];
   // The projected edition can contain new vocabulary and grammar not in the original.
   if(base.graded){importChapterLexicon(d,base);b.items={...b.items,...base.items};}
   const c=b.chapters[number-1];preserveLegacyEditionCursor(b);writeEditionState(c,selectedEdition(c.editionPrefs),{});c.editionPrefs=pref;b.activeEdition=selectedEdition(pref);if(mode==='read')rememberEditionChapter(b,b.activeEdition,number);
  },false,!!base.graded)){render();return;}
  installView(base,result,digest);preview=null;closeModal?.();render();
 }

 const btn=(action,label,extra='')=>`<button class="btn btn-secondary" data-action="reader-${action}" ${extra}>${esc(label)}</button>`;
 function selectBook(){
  const available=books();
  if(!libraryBook(novel)){novel=Object.keys(state().reader||{})[0]||available.find(x=>x.novel==='panlong')?.novel||available[0]?.novel||'';number=resumeChapter(novel,activeBookEdition(novel))||book()?.current||libraryBook(novel)?.chapters[0]?.number||1;}
  if(!libraryChapter(novel,number))number=book()?.current||libraryBook(novel)?.chapters[0]?.number||1;
 }
 async function openHosted(entry){
  if(!entry||entry.source==='custom')throw Error('Unknown hosted chapter.');
  const known=state().reader?.[entry.novel]?.chapters||[];
  const needed=catalog.filter(e=>e.novel===entry.novel&&e.number<=entry.number&&(e.number>known.length||known[e.number-1]?.digest!==e.digest&&knownMasterDigest(e,known[e.number-1]?.digest))).sort((a,b)=>a.number-b.number);
  const imported=[];
  for(const e of needed){
   const bytes=await downloadChapter(e),p=parseText(bytes);
   validateChapter(p);
   await (await caches.open(cacheName)).put(cacheKey(e.digest),new Response(bytes));
   imported.push({p,digest:e.digest});
  }
  await flush();
  if(imported.length){
   if(!await change(d=>{for(const {p,digest} of imported)acceptChapter(d,p,digest);},false,true))return false;
   memory.clear();
   for(const {p,digest} of imported)memory.set(digest,p);
  }
  return true;
 }
 function showMissing(entry){
  requestedUpload=entry;
  modal('Chapter file needed',`<p>The custom chapter <strong>${esc(chapterLabel(entry))}</strong> from <strong>${esc(libraryBook(entry.novel)?.title||entry.novel)}</strong> (Chapter ${entry.number}) is no longer stored on this device.</p><p class="subtle">Your chapter index, bookmark and study progress are saved in the backup. Reupload the matching Cíyán chapter JSON to restore its reading text.</p><button class="btn btn-primary btn-full" data-action="reader-reupload">Select chapter JSON</button>`);
 }
 async function loadSelection(id,n,{reading=false,automatic=false,edition=null}={}){
  if(selectionLoading||!libraryBook(id))return false;
  selectionLoading=true;
  try{
  const carry=edition??(id===novel&&n!==number&&chapter()?currentEdition():automatic||id!==novel?activeBookEdition(id):null);if(!await flush())return false;unmount();activeView=null;preview=null;novel=id;number=n;shown='';revealed=false;quotaDialogShownFor='';
  const entry=libraryChapter(id,n);
  if(!entry)return false;
  // Capture a pre-0.9.19 cursor before importing a chapter can replace b.current.
  const prior=state().reader?.[id];
  if(prior&&!prior.editionCurrent&&!await change(d=>preserveLegacyEditionCursor(d.reader[id]),false))return false;
  try{
   if(entry.source==='master'){
    if(!state().reader?.[id]?.chapters[n-1]||entry.digest!==state().reader[id].chapters[n-1].digest&&knownMasterDigest(entry,state().reader[id].chapters[n-1].digest)){
     try{if(!await openHosted(entry))throw Error('Could not save chapter update. Please retry.');}
     catch(error){const previous=state().reader?.[id]?.chapters[n-1];
      if(!previous||!(await cached(previous)))throw error;
      toast('Using the saved chapter. Select Update chapter to retry. '+error.message);
     }
    }
    const ch=state().reader?.[id]?.chapters[n-1];
    if(ch)await cached(ch,true);
   }else{
    const ch=state().reader?.[id]?.chapters[n-1];
    if(!ch||!(await cached(ch,true))){
     mode='review';render();if(!automatic)showMissing(entry);return;
    }
   }
   const ch=state().reader?.[id]?.chapters[n-1];
   if(ch){
    const wanted=carry&&editionEntries(id,carry).some(e=>e.number===n)?carry:carry?'original':selectedEdition(ch.editionPrefs);
    if(wanted!==selectedEdition(ch.editionPrefs)){
     if(!await change(d=>{const target=d.reader[id].chapters[n-1];writeEditionState(target,selectedEdition(target.editionPrefs),{});target.editionPrefs=selectEditionPrefs(target.editionPrefs,wanted);},false))throw Error('Could not save edition selection.');
    }
    await reopenView();
    if(!await change(d=>{const b=d.reader[id];b.current=n;b.activeEdition=currentEdition();if(reading)rememberEditionChapter(b,b.activeEdition,n);},false))throw Error('Could not save chapter selection.');
    mode=reading?'read':'review';
   }
   else mode='review';
   chromeVisible=true;render();return !!ch&&!needsChapterUpdate();
  }catch(e){toast(e.message);mode='review';render();return false;}
  }finally{selectionLoading=false;}
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
  const tabs=Object.entries(labels).map(([group,label])=>`<button class="reader-vocab-filter" data-action="reader-vocab-group" data-group="${group}" aria-pressed="${group===vocabGroup}"><span>${label}</span><strong>${groups[group].length}</strong></button>`).join('');
  const rows=keys.slice(vocabPage*20,vocabPage*20+20).map(key=>{
   const item=b.items[key];
   const card=item.kind==='vocab'?state().cards.find(w=>w.hanzi===item.hanzi):null;
   return `<button class="list-card reader-vocab-row${[...item.hanzi].length>6?' reader-vocab-row--long':''}" ${card?`data-action="card-detail" data-id="${esc(card.id)}"`:`data-action="reader-term-detail" data-key="${esc(key)}"`}><strong lang="zh-Hans">${esc(item.hanzi)}</strong><span>${esc(item.pinyin)}</span><small>${esc(item.english)}${earlier.has(key)?' · Earlier chapter':''}</small></button>`;
  }).join('');
  return `<section class="panel stack"><h2>Chapter vocabulary</h2><div class="reader-vocab-filters" role="group" aria-label="Chapter vocabulary filters">${tabs}</div>${rows||'<p class="subtle">No words in this group.</p>'}
   ${pages>1?`<div class="row">${btn('vocab-prev','Previous',vocabPage?'':'disabled')}<span>${vocabPage+1} / ${pages}</span>${btn('vocab-next','Next',vocabPage+1<pages?'':'disabled')}</div>`:''}</section>`;
 }
 function review(b,c,a){
  const ready=a.keys.length-a.weak.length;
  const percent=Math.round(100*ready/Math.max(1,a.keys.length));
  // a.focus includes earlier chapters' due terms for sampling. Only c.focus
  // describes THIS chapter's authored priority list; never label the union
  // as this chapter's new focused terms.
  return `<section class="panel stack reader-readiness"><div class="reader-readiness-heading"><h2>Chapter readiness</h2><strong>${percent}% ready</strong></div>
  <div class="reader-readiness-progress" role="progressbar" aria-label="Chapter ready items" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>
  <p class="reader-readiness-summary">${a.keys.length} study items · <strong>${c.focus.length} chapter terms/grammar</strong> (6× priority)</p>
  <div class="reader-readiness-stats"><span><strong>${ready}</strong> Ready</span><span><strong>${a.weak.length}</strong> To practice</span><button data-action="reader-earlier"><strong>${a.earlier.length}</strong> Earlier due</button></div>
  <div class="reader-readiness-actions">${btn('study','Study chapter')}</div>
  </section>${vocabulary(b,c,a)}`;
 }
 function study(b,c,a){
  let queue=a.queue;
  if(scope==='earlier')queue=a.earlier;
  if(scope==='weak')queue=a.weak;
  if(scope==='full')queue=[...new Set([...a.earlier,...a.keys])];
  // Every scope obeys the daily new-card gate and chapter exclusion rules.
  // Due cards remain eligible even with a high knowledge score.
  const blocked=new Set(a.blocked);
  queue=queue.filter(key=>!blocked.has(key)&&(a.group(key)===0||!a.qualifies(key)));
  const dueNow=queue.filter(key=>a.group(key)===0);
  const snapshotKey=`${novel}:${c.digest}:${scope}`;
  if(!chapterDueSnapshots.has(snapshotKey))chapterDueSnapshots.set(snapshotKey,[...dueNow]);
  const progress=studyProgressForState(state(),dueCompletion(chapterDueSnapshots.get(snapshotKey),dueNow));
  if(!queue.includes(shown)){shown=pickReaderItem(queue,a);revealed=false;}
  const choices=`<label class="reader-scope">Study list<select id="reader-scope">${[['gate','Auto chapter preparation'],['weak','Still to practice'],['earlier','Earlier items due'],['full','All chapter items']].map(([v,t])=>`<option value="${v}" ${v===scope?'selected':''}>${t}</option>`).join('')}</select></label>`;
  const item=b.items[shown];
  if(!item)return `${choices}${progress}<div class="panel stack"><h2>${a.blocked.length&&a.queue.length===0?'Daily study limit reached':'Chapter study list clear'}</h2><p class="subtle">${a.blocked.length&&a.queue.length===0?'No due or previously introduced cards remain to practise right now. Increase your daily limit or return after more reviews become due.':'No eligible cards are pending in this study list. Try another study list if you would like to continue.'}</p>${btn('review','Chapter overview')}</div>`;
  // The general flashcard hero assumes a one- or two-character word. Chapter
  // terms and grammar patterns can be 6–20+ characters and need their own scale.
  const length=[...item.hanzi].length;
  const size=item.kind==='grammar'||length>10?'extended':length>6?'long':length>3?'medium':'short';
  return `${choices}${progress}<section class="panel stack reader-study-card" data-study-key="${esc(shown)}" aria-label="Chapter flashcard">
  <div class="reader-study-head"><span>${a.earlier.includes(shown)?'Earlier review':'Chapter '+c.number} · ${esc(item.kind)}</span><span>Score ${a.score(shown).toFixed(2)}</span></div>
  <div class="reader-study-prompt reader-study-prompt--${size}" lang="zh-Hans">${esc(item.hanzi)}</div>
  ${revealed?`<div class="reader-study-answer"><div class="reader-study-pinyin">${esc(item.pinyin)}</div><p>${esc(item.english)}</p></div><div class="review-controls reader-study-grades">${['Again','Hard','Good','Easy'].map((x,i)=>{const due=a.group(shown)!==2;const next=readerGradePreview(state(),b,shown)[i];return `<button class="grade ${x.toLowerCase()}" data-action="reader-grade" data-key="${esc(shown)}" data-grade="${i+1}"><strong>${x}</strong><span>${due?intervalText(next.intervalMinutes*60):'Practice only'}</span><small>${due?'Score '+next.score.toFixed(2):'No score change'}</small></button>`;}).join('')}</div>`:`<div class="reader-study-reveal">${btn('reveal','Show answer')}</div>`}
  <footer class="reader-study-footer"><span>${a.focus.has(shown)?'Priority focus · 6× weight':'Automatic vocabulary'} · ${['Due review','New','Practice'][a.group(shown)]}</span><span>${a.recent.get(shown)?.goods||0}/3 Good · ${a.weak.length} left</span></footer>
  </section>`;
 }
 // Notify only once per exhausted chapter/day, and only when there is no
 // remaining due or previously introduced practice in *any* study scope.
 // Rendering the flashcard must remain free of modal side effects.
 function notifyQuotaExhaustion(){
  if(mode!=='study')return;
  const b=book(),c=studyChapter();if(!b||!c)return;
  const a=analysis(state(),b,c);
  if(a.queue.length||!a.blocked.length){quotaDialogShownFor='';return;}
  const day=new Date().toLocaleDateString('en-CA');
  const key=`${novel}:${c.digest}:${day}`;
  if(quotaDialogShownFor===key)return;
  quotaDialogShownFor=key;
  modal('Daily study limit reached',`<p>You have reached today's new-vocabulary limit, and there are no due or previously introduced chapter cards left to practise right now.</p><p><strong>${a.blocked.length}</strong> new chapter ${a.blocked.length===1?'item remains':'items remain'} (vocabulary, terms or grammar). To introduce more today, increase the daily limit in Settings. Otherwise, return when more reviews are due.</p><div class="reader-read-confirm"><button class="btn btn-primary" data-action="navigate" data-page="settings">Daily limit settings</button><button class="btn btn-secondary" data-action="reader-review">Chapter overview</button></div>`);
 }
 function article(p,a){
  const later=libraryChapter(novel,p.number+1);
  const dictionary=new Map([...state().archived?.cards||[],...state().cards].map(w=>[w.hanzi,w]));
  const edition=currentEdition(),complete=editionState(book()?.chapters[p.number-1],edition).complete;
  return `<article data-reader-number="${p.number}"><h2>${esc(chapterLabel(p))}</h2>${p.paragraphs.map((row,index)=>{
   let offset=0,wordIndex=0;
   return `<div class="reader-paragraph"><p data-pid="${esc(paragraphId(edition,row.id))}" data-source-pid="${esc(row.id)}" data-chinese="${esc(row.tokens.map(t=>typeof t==='string'?t:t[1]??p.items[t[0]].hanzi).join(''))}" data-index="${index}">${row.tokens.map((t,i)=>{
    if(typeof t==='string'){offset+=t.length;return esc(t);}
    const k=t[0],item=p.items[k],definition=item.kind==='vocab'?(dictionary.get(item.hanzi)||item):item,surface=t[1]??item.hanzi,start=offset;offset+=surface.length;
    return `<span role="button" tabindex="0" data-word-index="${wordIndex++}" data-key="${esc(k)}" data-source-offset="${row.anchors?.[i]??start}" data-change="${esc(projection()?.changed.get(row.id+':'+i)||'')}" data-offset="${start}" data-surface="${esc(surface)}" data-score="${a.score(k)}" class="reader-aid-word ${p.items[k].kind==='term'?'reader-term':''} ${a.struggle(k)?'reader-weak':''}" aria-label="${esc(surface)}. Double-tap for dictionary"><span class="reader-hanzi">${esc(surface)}</span><span class="reader-aid-pinyin">${esc(definition.pinyin)}</span><span class="reader-aid-english">${esc(definition.english.split(/[;；]/)[0])}</span></span>`;
   }).join('')}</p><div class="reader-translation" data-reader-translation ${state().settings.readerParagraphTranslation?'':'hidden'}><button class="reader-translate-button" data-action="reader-translate" aria-label="Translate paragraph with Google">Translate with Google</button><div class="reader-translation-result" hidden role="status"></div></div></div>`;
  }).join('')}<div class="reader-end"><div class="reader-end-label">End of chapter ${p.number}</div><button class="reader-finish-next" data-action="reader-finish-next" data-number="${p.number}">${complete?'Completed · ':''}${later?'Mark complete & next chapter →':'Mark chapter complete ✓'}</button></div></article>`;
 }
 function isReading(){return mode==='read'&&!!chapter()&&memory.has(chapter().digest);}
 function chapterNavigation(){
  const list=libraryBook(novel)?.chapters||[];
  const position=list.findIndex(c=>c.number===number),previous=list[position-1],next=list[position+1];
  return `<header class="reader-topbar" data-reader-ui><button class="reader-top-btn reader-exit" data-action="reader-exit" aria-label="Exit reader">‹ <span>Library</span></button><nav class="reader-chapter-nav" aria-label="Chapter navigation"><button data-action="reader-previous" ${previous?'':'disabled'} aria-label="Previous chapter">‹</button><span>${position+1} / ${list.length}</span><button data-action="reader-following" ${next?'':'disabled'} aria-label="Next chapter">›</button></nav><button class="reader-top-btn reader-toc-button" data-action="reader-toc" aria-label="Table of contents">☷</button></header>`;
 }
 function readerChrome(){
  const entries=libraryBook(novel)?.chapters||[];
  return `${chapterNavigation()}<aside class="reader-toc-sheet" data-reader-toc hidden data-reader-ui><div class="reader-sheet-head"><strong>Table of contents</strong><button data-action="reader-toc" aria-label="Close contents">×</button></div><div class="reader-toc-list">${entries.map((c,i)=>`${c.volume&&(i===0||entries[i-1].volume!==c.volume)?`<h3 class="reader-volume-heading">${esc(volumeLabel(c.volume,c.volumeTitle))}</h3>`:''}<button data-action="reader-jump" data-number="${c.number}" ${c.number===number?'aria-current="page"':''}><span>${esc(chapterTitle(c))}</span><small>Chapter ${c.number}${editionState(book()?.chapters[c.number-1],currentEdition()).complete?' · Finished':''}</small></button>`).join('')}</div></aside>
  <div class="reader-dock" data-reader-ui><div class="reader-playback" data-guide-controls hidden><div class="reader-transport"><button data-guide="back" aria-label="Previous word">≪</button><button data-guide="play" aria-label="Play or pause guide">Play</button><button data-guide="forward" aria-label="Next word">≫</button><button data-guide="slower" aria-label="Slower">−</button><output></output><button data-guide="faster" aria-label="Faster">+</button></div><div class="reader-audio-line" data-audio-controls hidden><label class="reader-voice">Voice<select data-selected="${esc(state().settings.speechVoice||'')}" data-voice-select aria-label="Mandarin voice"></select></label><small data-speech-status role="status"></small></div></div><button class="reader-more-button" data-action="reader-options" aria-label="More reader settings" aria-expanded="false">···</button></div>
  <aside class="reader-settings-sheet" data-reader-settings-sheet hidden data-reader-ui><div class="reader-sheet-head"><strong>Reading options</strong><button data-action="reader-options" aria-label="Close reading options">×</button></div>${hasGraded()?`<div class="reader-choices">${editionSelector()}</div>`:''}${autoControl()}<button class="btn btn-secondary btn-full" data-guide="toggle" aria-pressed="false">Enable reading guide</button><label class="reader-option"><input type="checkbox" data-guide-audio> Read aloud in Mandarin</label>${aidSettings(state().settings,true)}<label class="reader-option"><input type="checkbox" id="reader-translate-in-book" ${state().settings.readerParagraphTranslation?'checked':''}> Paragraph translation</label><button class="btn btn-secondary btn-full" data-action="reader-translation-diagnostics">Export translation diagnostics</button><label class="reader-option"><input type="checkbox" id="reader-terms-in-book" ${state().settings.readerTermsHighlight!==false?'checked':''}> Mark novel-specific terms</label><div class="reader-cloud-config" data-cloud-config hidden><button class="btn btn-secondary" data-action="navigate" data-page="settings" data-section="Speech">Speech settings &amp; credentials</button></div><p class="subtle">Single tap: show/hide controls. Double-tap a word: dictionary.</p></aside>`;
 }
 function view(){
  selectBook();
  const available=books(),lib=libraryBook(novel),entry=libraryChapter(novel,number);
  const b=book(),c=studyChapter();
  const importBtn=btn('import','Import chapter JSON');
  const offlineBtn=btn('offline-packs','Offline reader packs');
  const volumes=volumeList(lib),currentVolume=lib?.chapters.find(c=>c.number===number)?.volume??volumes[0]?.number;
  // Volume is solely a chapter picker filter. No volume-specific progress or
  // unlock state is created; chapters remain globally numbered and linear.
  const chapterChoices=volumes.length?chaptersInVolume(lib,currentVolume):lib?.chapters||[];
  const chooser=`<div class="reader-heading"><h1 class="h1">Reader</h1>${importBtn}</div>${offlineBtn}<div class="reader-choices"><label>Novel<select id="reader-novel">${available.map(x=>`<option value="${esc(x.novel)}" ${x.novel===novel?'selected':''}>${esc(x.author)} • ${esc(x.title)}</option>`).join('')}</select></label>${volumes.length>1?`<label>Volume<select id="reader-volume">${volumes.map(v=>`<option value="${v.number}" ${v.number===currentVolume?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label>`:''}<label>Chapter<select id="reader-chapter">${chapterChoices.map(x=>`<option value="${x.number}" ${x.number===number?'selected':''}>${esc(chapterLabel(x))}</option>`).join('')}</select></label>${editionSelector()}</div>`;
  if(!entry)return `${chooser}<div class="panel stack"><h2>No chapters yet</h2>${importBtn}</div>`;
  if(!b||!c){return `${chooser}<div class="panel stack"><h2>${esc(chapterLabel(entry))}</h2><p>${entry.source==='master'?'Hosted chapter: select it to download and prepare for study.':'Custom chapter: upload its JSON to read it again.'}</p>${btn('open','Open selected chapter')}</div>`;}
  const a=analysis(state(),b,c);
  const tabs=['review','study','read'].map(x=>btn(x,x[0].toUpperCase()+x.slice(1),`aria-pressed="${mode===x}"${x==='read'?` data-read-state="${a.ready?'ready':'caution'}"`:''}`)).join('');
  const p=projection()?.p||memory.get(c.digest);
  const body=mode==='study'?study(b,c,a):mode==='read'?p?`<div id="reader-pages" data-aid="${aidLevel(state().settings)}" class="${aidLevel(state().settings)>0?'show-weak':''} ${state().settings.readerTermsHighlight!==false?'show-terms':''} ${chromeVisible?'':'reader-ui-hidden'}">${readerChrome()}${article(p,a)}</div>`:`<div class="panel stack"><h2>Reload ${esc(chapterLabel(c))}</h2><p>Progress is retained but this chapter’s text is not available in the device cache.</p>${btn('open','Restore chapter')}</div>`:review(b,c,a);
  if(isReading())return body;
  return `${chooser}${autoControl()}<div class="reader-tabs">${tabs}</div>${body}`;
 }
 async function cached(c,refresh=false){
  if(!refresh&&memory.has(c.digest))return memory.get(c.digest);
  const cache=await caches.open(cacheName);
  let res=await cache.match(cacheKey(c.digest));
  const hosted=catalog.find(e=>e.digest===c.digest);
  if(!res&&memory.has(c.digest))return memory.get(c.digest);
  if(!res&&hosted){
   try{res=new Response(await downloadChapter(hosted));await cache.put(cacheKey(c.digest),res.clone());}
   catch(e){toast(e.message);return;}
  }
  if(res){const bytes=await res.arrayBuffer();
   if(await contentDigest(bytes)!==c.digest)throw Error('Cached chapter changed. Reload its original file.');
   const p=parseText(bytes);validateChapter(p);
   if(c.boundaries!==p.boundaries){
    if(!await change(d=>{const b=d.reader[p.novel],current=b.current;acceptChapter(d,p,c.digest);b.current=current;},false,true))return;
   }
   memory.set(c.digest,p);return p;}
 }
 async function flush(){
  let previousOk=true;
  while(writingPosition)previousOk=(await writingPosition)!==false&&previousOk;
  clearTimeout(timer);const pos=pending,cpm=pendingRate;const playback=pendingPlayback;
  if(!pos&&cpm===null&&!playback)return previousOk;
  // Gesture and chapter-open callbacks sometimes report the same bookmark.
  // Avoid a needless IndexedDB revision (and therefore cloud backup) if the
  // stored position and playback settings are already identical.
  const saved=pos&&state().reader?.[pos.novel]?.chapters?.[pos.number-1];
  const samePosition=!pos||(saved?.digest===pos.digest&&JSON.stringify(editionState(saved,pos.edition).position)===JSON.stringify(pos.position));
  const samePlayback=!playback||Object.entries(playback).every(([k,v])=>state().settings[k]===v);
  const sameRate=cpm===null||(state().settings.speechVoice===cpm.voice&&voiceTuning(state().settings,cpm.voice).readerCpm===cpm.rate);
  if(samePosition&&samePlayback&&sameRate){pending=null;pendingPlayback=null;pendingRate=null;return previousOk;}

  pendingPlayback=null;
  pendingRate=null;
  pending=null;
  writingPosition=change(d=>{if(playback)Object.assign(d.settings,playback);if(cpm){
   const s=d.settings,old=s.speechVoice||'',tuning={...voiceTuning(s,cpm.voice),readerCpm:cpm.rate};
   s.voiceProfiles={...s.voiceProfiles,[old]:voiceTuning(s,old),[cpm.voice]:tuning};
   Object.assign(s,tuning,{speechVoice:cpm.voice});
  }if(!pos)return;const b=d.reader?.[pos.novel],c=b?.chapters[pos.number-1];if(c?.digest===pos.digest){writeEditionState(c,pos.edition,{position:pos.position});rememberEditionChapter(b,pos.edition,pos.number);}},false);
  const ok=await writingPosition;writingPosition=null;
  if(!ok){pendingPlayback??=playback;if(pendingRate===null)pendingRate=cpm;if(!pending)pending=pos;timer=setTimeout(flush,400);}
  return ok===true;
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
   const entry=libraryChapter(novel,number),token=`${novel}:${number}:${entry?.digest}:${chapter()?.digest}`;
   if(!selectionLoading&&entry&&token!==attemptedInitial&&(!chapter()||needsChapterUpdate()||!memory.has(chapter().digest))){
    attemptedInitial=token;
    if(entry.source==='master')void loadSelection(novel,number,{automatic:true});
    else void (async()=>{try{if(!chapter()||!(await cached(chapter())))showMissing(entry);}catch(error){toast(error.message);showMissing(entry);}})();
   }
   return;
  }
  for(const row of el.querySelectorAll('.reader-paragraph')){
   const text=row.querySelector('[data-chinese]')?.dataset.chinese,prev=paragraphTranslations.get(text);
   if(prev?.expanded&&prev.expires>Date.now()){const target=row.querySelector('.reader-translation-result');showTranslation(target,prev.text);row.querySelector('.reader-translate-button').textContent='Hide translation';}
  }
  const c=chapter();
  disposeGuide=mountReadingGuide(el,{position:pending?.digest===c.digest&&pending.edition===currentEdition()?pending.position:scopedPosition(editionState(c,currentEdition()).position,currentEdition()),initialRate:pendingRate?.rate??state().settings.readerCpm??120,
   speechSettings:()=>state().settings,credentials:()=>credentials(),voiceChanged:voice=>{pendingRate={voice,rate:voiceTuning(state().settings,voice).readerCpm};return flush();},
   initialGuide:state().settings.readerGuideEnabled===true,initialAudio:state().settings.readerTtsEnabled===true,
   onPlaybackChange:(guide,audio)=>{pendingPlayback={readerGuideEnabled:guide,readerTtsEnabled:audio};void flush();},
   onTap:toggleChrome,rateChanged:(rate,voice)=>{pendingRate={rate,voice};void flush();},extend:async()=>{},
   define:(word,focus)=>{focusWord=focus;void action('define',word);},
   save:(n,position)=>{
    position.guided=el.classList.contains('guided');
    const ch=book()?.chapters[n-1];if(!ch)return;
    if(!pending&&JSON.stringify(editionState(ch,currentEdition()).position)===JSON.stringify(position))return;
    const hadPending=!!pending;pending={novel,number:n,digest:ch.digest,edition:currentEdition(),position};
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
    const bytes=await file.arrayBuffer(),p=parseText(bytes);
    const digest=await contentDigest(bytes);
    validateChapter(p);
    if(!matchesRequestedChapter(p,requestedUpload,digest))
     throw Error(`Wrong chapter. Select ${requestedUpload?.title||'the requested chapter'} (Chapter ${requestedUpload?.number}) from ${libraryBook(requestedUpload?.novel)?.title||requestedUpload?.novel}.`);
    // Stage and validate before writing any text. An interrupted import can only leave an unreferenced cache entry.
    const staged=structuredClone(state());
    acceptChapter(staged,p,digest);
    await (await caches.open(cacheName)).put(cacheKey(digest),new Response(bytes));
    await flush();
    if(await change(d=>{acceptChapter(d,p,digest);registerCustomChapter(d,p,digest);},false,true)){
     memory.clear();memory.set(digest,p);novel=p.novel;number=p.number;mode='review';shown='';revealed=false;attemptedInitial=`${novel}:${number}`;requestedUpload=null;closeModal?.();render();toast('Chapter loaded.');
    }
   }catch(e){toast(e.message);}finally{input.remove?.();}
  };input.click();
 }
 async function showOfflinePacks(){
  const groups=(await offlineRequest('status')).filter(g=>g.group.startsWith('reader:'));
  const names={'reader:original':'Original chapters','reader:hsk4':'HSK4 + TSK8','reader:hsk5':'HSK5 + TSK10','reader:hsk6':'HSK6 + TSK12'};
  const mib=n=>(n/1048576).toFixed(2)+' MiB';
  modal('Offline reader packs',`<p>Download a published edition for reading offline. Graded packs include the matching original archives. Shared files are kept when other complete packs need them. Imported chapter text and study progress are not changed.</p>${groups.map(g=>`<div class="panel stack"><strong>${esc(names[g.group]||g.group)}</strong><small>${g.complete?'Ready offline':`${g.count}/${g.total} files`} · ${mib(g.bytes)} / ${mib(g.totalBytes)}</small><button class="btn btn-secondary" data-action="reader-offline-download" data-group="${esc(g.group)}" ${g.complete?'disabled':''}>Download</button>${g.count?`<button class="btn btn-secondary" data-action="reader-offline-remove" data-group="${esc(g.group)}">Remove unused pack files</button>`:''}</div>`).join('')}<p class="subtle" aria-live="polite" data-offline-status></p>`);
 }
 async function action(name,el){
  if(name==='translate'){
   const row=el.closest('.reader-paragraph'),target=row?.querySelector('.reader-translation-result'),text=row?.querySelector('[data-chinese]')?.dataset.chinese;
   if(!text||!target||el.disabled)return;
   const prev=paragraphTranslations.get(text);
   if(!target.hidden&&prev?.expanded){prev.expanded=false;target.hidden=true;el.textContent='Translate with Google';return;}
   el.disabled=true;el.textContent='Translating…';target.hidden=true;
   try{if(enforceTranslationAttribution)await requireTranslationBadge();const value=await translate(text,{fetcher:profileTranslationFetch(captureUsage())});if(!row.isConnected||row.querySelector('[data-chinese]')?.dataset.chinese!==text)return;
    paragraphTranslations.set(text,{text:value,expanded:true,expires:Date.now()+7*86400000});if(paragraphTranslations.size>2000)paragraphTranslations.delete(paragraphTranslations.keys().next().value);showTranslation(target,value);el.textContent='Hide translation';
   }catch(error){if(row.isConnected){target.textContent=error.message;target.hidden=false;el.textContent='Retry translation';}}
   finally{el.disabled=false;}return;
  }
  if(name==='translation-diagnostics'){
   const report=getTranslationDiagnostics();
   try{await shareFile(new File([JSON.stringify(report,null,2)],'translation-diagnostics-'+new Date().toISOString().slice(0,10)+'.json',{type:'application/json'}));}catch(e){if(e.name!=='AbortError')toast('Could not export translation diagnostics.');}return;
  }
  if(name==='clear-translation-diagnostics'){clearTranslationDiagnostics();toast('Translation diagnostics cleared.');return;}
  if(name==='clear-translation-cache'){await clearTranslationCache();paragraphTranslations.clear();toast('Translation cache cleared.');return;}
  if(busy)return;busy=true;
  try{
   if(name==='offline-packs'){await showOfflinePacks();return;}
   if(name==='offline-download'||name==='offline-remove'){
    const status=document.querySelector('[data-offline-status]');el.disabled=true;
    try{await offlineRequest(name==='offline-download'?'download':'remove',el.dataset.group,(done,total)=>{if(status)status.textContent=`Downloading ${done}/${total} files…`;});await showOfflinePacks();}
    finally{el.disabled=false;}return;
   }
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
   const b=book(),c=studyChapter();if(!c)return;
   if(name==='edition'||name==='auto'||name==='auto-apply'||name==='auto-off'||name==='restore-word'){
    if(name==='edition'){
     const wanted=el.dataset.edition;if(!EDITIONS.includes(wanted)||!hasGraded())return;
     if(wanted===currentEdition()&&!needsChapterUpdate())return;
     const destination=resumeChapter(novel,wanted);
     if(destination&&destination!==number){await loadSelection(novel,destination,{reading:mode==='read',edition:wanted});return;}
    }
    if(name==='edition'&&needsChapterUpdate()){
     if(!await loadSelection(novel,number,{reading:mode==='read'})){toast('Chapter update is required for the graded edition. Retry when online.');render();return;}
    }
    const original=await cached(chapter());if(!original)return;
    const pref={...prefs()},digest=chapter().digest;
    if(name==='auto'){await openAuto(original);return;}
    if(name==='auto-apply'){
     if(!preview||preview.digest!==digest)return;preview.update();
     await saveEdition({...pref,minimum:preview.minimum,auto:true},preview.base,preview.result,digest,preview.threshold);return;
    }
    if(name==='edition'){
     if(!hasGraded()||!EDITIONS.includes(el.dataset.edition))return;
     Object.assign(pref,selectEditionPrefs(pref,el.dataset.edition));if(el.dataset.edition==='graded')delete pref.level;
    }
    if(name==='auto-off')pref.auto=false;
    if(name==='restore-word')pref.restored=[...new Set([...(pref.restored||[]),el.dataset.loc])];
    const base=await baseEdition(original,needsChapterUpdate()?'original':selectedEdition(pref));
    await saveEdition(pref,base,pref.auto?compute(base,learnerIndex(state()),pref.minimum??.92,pref.restored):null,digest);return;
   }
   if(name==='vocab-group'||name==='vocab-prev'||name==='vocab-next'){
    if(name==='vocab-group'){vocabGroup=el.dataset.group;vocabPage=0;}
    else vocabPage+=name==='vocab-prev'?-1:1;
    render();return;
   }
   if(name==='term-detail'){
    const key=el.dataset.key,item=b.items[key];if(!item)return;
    const hits=b.history.filter(h=>h.key===key),score=b.progress[key];
    const chapterCount=b.chapters.filter(ch=>ch.all.includes(key)).length;
    modal('Novel-specific term',`<div class="reader-term-full"><div class="detail-hero"><div class="review-hanzi">${esc(item.hanzi)}</div><div class="review-pinyin">${esc(item.pinyin)}</div><div class="review-english">${esc(item.english)}</div></div><p class="subtle">Novel: ${esc(b.title)} · Found in ${chapterCount} loaded chapter${chapterCount===1?'':'s'}. This term is deliberately separate from your master dictionary.</p><div class="reader-term-stats"><span><strong>${hits.length}</strong> Reviews</span><span><strong>${score?.score.toFixed(2)??'0.00'}</strong> Score</span><span><strong>${score?.dueAt?new Date(score.dueAt).toLocaleString():'Not studied'}</strong> Next review</span></div><button class="btn btn-secondary btn-full" data-action="say-text" data-text="${esc(item.hanzi)}">Listen</button></div>`);return;
   }
   if(name==='define'){
    const item=b.items[el.dataset.key];if(!item)return;
    const match=state().cards.find(card=>card.hanzi===item.hanzi);
    const replacement=projection()?.result?.changes.get(el.dataset.change);
    const source=el.closest?.('p')?.dataset.sourcePid;
    const raw=source&&memory.get(c.digest),row=raw?.paragraphs?.find(r=>r.id===source);
    const sourceText=row?.tokens.map(t=>typeof t==='string'?t:t[1]??raw.items[t[0]].hanzi).join('');
    modal(item.hanzi,`<div class="reader-definition"><p class="review-pinyin">${esc(item.pinyin)}</p><p>${esc(item.english)}</p><small>${esc(item.kind)}</small>${replacement?`<p>Before Auto · ${esc(replacement.src)} → ${esc(replacement.targets.join(''))} · ${replacement.similarity??'reviewed phrase'}</p>${btn('restore-word','Restore this occurrence','data-loc="'+esc(el.dataset.change)+'"')}`:''}${sourceText&&projection()?`<details><summary>Original paragraph</summary><p>${esc(sourceText)}</p></details>`:''}<div class="reader-definition-actions">${focusWord?btn('focus',state().settings.readerTtsEnabled?'Read from here':'Guide from here'):''}<button class="btn btn-secondary" data-action="say-text" data-text="${esc(item.hanzi)}">Listen</button>${match?`<button class="btn btn-secondary" data-action="card-detail" data-id="${esc(match.id)}">View full entry</button>`:''}</div></div>`);return;
   }
   await flush();
   if(name==='exit'){mode='review';chromeVisible=true;render();globalThis.scrollTo?.(0,0);return;}
   if(name==='finish-next'||name==='finish'){
    const index=Number(el.dataset.number)-1;
    if(await change(d=>{writeEditionState(d.reader[novel].chapters[index],currentEdition(),{complete:true});},false))toast('Chapter marked complete.');
    if(name==='finish-next'){
     const later=libraryBook(novel)?.chapters.find(x=>x.number===index+2);
     if(later){await choose(novel,later.number,{reading:true});return;}
     mode='review';render();return;
    }
    return;
   }
   if(name==='read'||name==='read-anyway'){
    const a=analysis(state(),b,c);
    if(name==='read'&&!a.ready){
     modal('Read before finishing study?',`<p>You have <strong>${a.keys.length-a.weak.length} out of ${a.keys.length}</strong> study items ready (${Math.round(100*(a.keys.length-a.weak.length)/Math.max(1,a.keys.length))}%). We recommend studying more before reading this chapter, but you can continue whenever you want.</p><div class="reader-read-confirm"><button class="btn btn-primary" data-action="reader-study">Return to study</button><button class="btn btn-secondary" data-action="reader-read-anyway">Read anyway</button></div>`);return;
    }
    closeModal?.();
    if(!(await cached(c))){showMissing(libraryChapter(novel,number));return;}
    if(sourceBook().editionCurrent?.[currentEdition()]!==number||sourceBook().activeEdition!==currentEdition()||sourceBook().current!==number){if(!await change(d=>{rememberEditionChapter(d.reader[novel],currentEdition(),number);},false))return;}
    mode='read';chromeVisible=true;
   }else if(name==='grade'){
    if(!revealed||shown!==el.dataset.key)return;
    const grade=Number(el.dataset.grade),now=Date.now(),session=evidence();
    const early=readerAnalysis(state(),b,c,now,session).group(shown)===2;
    // Not-due cards can be practiced indefinitely, but must not modify their
    // original score, due date, or review history. The three-Good/one-Easy
    // threshold retires them from this chapter practice session.
    if(!early){
     let applied=false;
     const learningItem=b.items[shown];
     const master=learningItem.kind==='vocab'?state().cards.find(x=>x.hanzi===learningItem.hanzi):null;
     // Legacy or offline chapters can still have vocabulary that predates the
     // automatic lexicon import. Persist any resulting card/tag additions.
     const contentChange=learningItem.kind==='vocab'&&(!master||!master.tags.includes(`Reader/${b.title}`));
     const ok=await change(d=>{const saved=d.reader[novel];if(!saved.items[shown])saved.items={...saved.items,[shown]:learningItem};applied=gradeReader(d,saved,shown,grade,now);},false,contentChange);
     if(!ok||!applied){toast('Daily new-vocabulary limit reached, or review is not due yet.');shown='';revealed=false;render();notifyQuotaExhaustion();return;}
    }
    if(early){
     const key=shown,at=new Date(now).toISOString();
     if(!await change(d=>{const saved=d.reader[novel];if(!saved.items[key])saved.items={...saved.items,[key]:b.items[key]};saved.practiceHistory=[...(saved.practiceHistory||[]).filter(h=>Date.parse(h.at)>now-86400000),{key,grade,at,id:crypto.randomUUID()}];},false))return;
    }
    recordPractice(session,shown,grade);
    shown='';revealed=false;
   }else if(name==='reveal'){revealed=true;}
   else if(['study','review','weak','earlier'].includes(name)){closeModal?.();chapterDueSnapshots.clear();scope=['weak','earlier'].includes(name)?name:'gate';mode=name==='review'?'review':'study';shown='';revealed=false;}
   render();
   notifyQuotaExhaustion();
  }catch(e){toast(e.message);if(name==='edition')render();}finally{busy=false;}
 }
 document.addEventListener('input',e=>{
  const key=e.target.dataset?.readerAid;if(!key)return;
  const settings={...state().settings,[key]:Number(e.target.value)};
  const output=e.target.parentElement.querySelector('output');if(output)output.textContent=key==='readerAidLevel'?AID_LABELS[aidLevel(settings)]:Number(e.target.value).toFixed(1);
  const root=document.querySelector('#reader-pages');if(!root)return;
  const anchor=root.querySelector('.reader-current')||[...root.querySelectorAll('[data-pid]')].find(r=>r.getBoundingClientRect().bottom>0);
  const before=anchor?.getBoundingClientRect().top;updateAidDisplay(root,settings);
  if(anchor&&Number.isFinite(before))globalThis.scrollBy?.(0,anchor.getBoundingClientRect().top-before);
 });
 document.addEventListener('change',async e=>{
  if(e.target.dataset?.readerAid){
   const key=e.target.dataset.readerAid,value=Number(e.target.value);await flush();
   await change(d=>{d.settings[key]=value;},false);updateAidDisplay(document.querySelector('#reader-pages'),state().settings);return;
  }
  if(e.target.id==='reader-translate-in-book'){
   const checked=e.target.checked;await change(d=>{d.settings.readerParagraphTranslation=checked;},false);
   for(const el of document.querySelectorAll('.reader-translation'))el.hidden=!state().settings.readerParagraphTranslation;return;
  }
  if(e.target.id==='reader-terms-in-book'){
   const checked=e.target.checked;await flush();
   if(await change(d=>{d.settings.readerTermsHighlight=checked;},false))document.querySelector('#reader-pages')?.classList.toggle('show-terms',checked);
   else e.target.checked=state().settings.readerTermsHighlight!==false;
  }
  if(e.target.id==='reader-scope'){scope=e.target.value;shown='';revealed=false;chapterDueSnapshots.clear();render();notifyQuotaExhaustion();}
  if(e.target.id==='reader-volume'){
   const destination=chaptersInVolume(libraryBook(novel),Number(e.target.value))[0];
   if(destination)void choose(novel,destination.number);
  }
  if(e.target.id==='reader-edition'){await action('edition',{dataset:{edition:e.target.value}});return;}
  if(e.target.id==='reader-chapter')void choose(novel,+e.target.value);
  if(e.target.id==='reader-novel'){
   const id=e.target.value,edition=activeBookEdition(id),stored=resumeChapter(id,edition);
   const selected=libraryBook(id)?.chapters.find(c=>c.number===stored)||libraryBook(id)?.chapters[0];
   if(selected)void loadSelection(id,selected.number,{edition});
  }
 });
 globalThis.addEventListener?.('pagehide',()=>void flush());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush();});
 return {view,isReading,mount,unmount,action,flush,reset(){unmount();activeView=null;preview=null;gradedAssets.clear();pendingPlayback=null;pendingRate=null;sessions.clear();paragraphTranslations.clear();clearTimeout(timer);pending=null;memory.clear();novel='';number=1;shown='';mode='review';attemptedInitial='';quotaDialogShownFor='';}};
}
