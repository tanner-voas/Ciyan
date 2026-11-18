import {APP_VERSION} from './backup-versions.js';
import {normalizeTags,tagNodes,matchesTagFilters,tagMatches,tagLabel} from './tags.js';
import {leafTagPaths,newWordOdds,validatedTagWeights} from './tag-weights.js';
import {contextsForWord} from './grammar-context.js';
import {contextMatches,contextSort,contextMatchLabel,literalGrammarTokens} from './context-matching.js';
import {MODES,SHARES,ensureStudy,nextExercise,recordExercise,scheduleFor,skillSummary,contextFor,modeCounts,availableModes,newVocabToday,newVocabRemaining,sessionAvailability,POOLS} from './study-engine.js';
import {allParticles,particleCorrect,particleSentence,particleError,particleLabel,OMIT} from './particles.js';
import {characterEvidence,familyEvidence,drawingProfile} from './learning-feedback.js';
import {drawPad,attachPad} from './drawing.js';
import {DRAWING_RATINGS,drawingResult,withDrawingRating} from './drawing-grades.js';
import {prepareVerifiedBackup} from './backup-integrity.js';
import {mergeRestoredContent} from './backup-restore.js';
import {FONT_LEVELS,FONT_IDS,fontChoices,selectedFonts,normalizeFontSettings,applyFontToRoot,verifyFontSelection,FONT_CATALOG,requiredFonts,normalizeFontSizing,normalizeTypographySettings,FONT_SCALE_MIN,FONT_SCALE_MAX,MASTER_SCALE_MIN,MASTER_SCALE_MAX} from './fonts.js';
import {initializeFontLibrary,importFontFile,removeFontFile,getImportedFonts,fontLibraryError} from './font-library.js';
import {MASTER} from './master-data.js';
import {replaceMaster,reconcileBundledMaster} from './master.js';
import {rememberAnswer,undoAnswer,skipItem,postponeItem,availability,itemKey} from './session-controls.js';
import {MODEL,retrievability} from './fsrs.js';
import {scheduleReview,previewIntervals,previewOutcomes,DEFAULT_RETRY,UNITS,retrySeconds,rescheduleExisting,dueHistogram,intervalText,interpolatedSeconds,timingImpact,upgradeScores} from './review-scheduler.js';
import {loadState,saveState,cloneProgressState,defaultState,normalizeCard,makeBackup,parseBackup,migrateState,mergeDeck,makeDeck,clearLearningRecords,deleteConfirmationValid} from './storage.js';
import {normalizeGrammar,parseSegments,plainSentence,grammarTags,linkedWords,requiredWords,grammarScores,wordKnowledge,toneTargets,grammarMistakes} from './grammar.js';

const $=selector=>document.querySelector(selector);
let lastAcceptedFont=normalizeTypographySettings({enabledFonts:['print']});
let fontSelectionCounter=0;
let pendingFont=null;
let applyingFont=false;
const fontLabel=id=>Object.values(FONT_LEVELS).flat().find(([key])=>key===id)?.[1]||id;
const cloneFont=s=>structuredClone(normalizeTypographySettings(s));
const scaleText=value=>`${Number(value).toFixed(2)}×`;
function fontUnavailableDialog(requested,result){
 const labels=(result.missing||[]).map(fontLabel),details=labels.join(', ')||'A selected font';
 const firstMissing=(result.missing||[])[0];
 modal('Font unavailable',`<p class="font-error-message"><strong>${esc(details)}</strong> could not be loaded.</p><p class="font-install-hint">Cíyán attempted to download and cache the required web-font files. If the download fails, you can upload a .ttf, .otf or .woff2 file instead.</p><p class="subtle">No selection was applied. Your previous fonts and learning data are unchanged. ${esc(result.reason||'')}</p><div class="font-recovery-actions"><button class="btn btn-primary btn-full" data-action="close-modal">Keep previous fonts</button>${firstMissing?`<button class="btn btn-secondary btn-full" data-action="upload-missing-font" data-font-id="${esc(firstMissing)}">Upload font file</button>`:''}</div>`);
}
let uploadingFontSlot=null;
function fontChecklistMarkup(settings){
 const selected=new Set(normalizeFontSettings(settings).enabledFonts),files=getImportedFonts();
 const sizes=normalizeFontSizing(settings);
 return `<div class="font-master-size"><div class="font-size-label"><label for="font-master-size"><strong>Master Chinese text size</strong></label><output id="font-master-size-value" for="font-master-size">${scaleText(sizes.fontMasterScale)}</output></div><input type="range" id="font-master-size" data-font-master-scale="1" min="${MASTER_SCALE_MIN}" max="${MASTER_SCALE_MAX}" step="0.01" value="${sizes.fontMasterScale}" aria-label="Master Chinese text size"><small>Scales all selected Chinese fonts together. Default 1.00×.</small></div>
 <div class="font-checklist" role="group" aria-label="Enabled Chinese fonts">${Object.entries(FONT_LEVELS).map(([level,choices])=>`<div class="font-checklist-group"><div class="font-checklist-title">${level[0].toUpperCase()+level.slice(1)}</div>${choices.map(([id,label])=>`<div class="font-checklist-item"><label class="font-checklist-row"><input type="checkbox" data-font-id="${id}" ${selected.has(id)?'checked':''} aria-label="${esc(label)}"><span class="font-checklist-detail"><strong>${esc(label)}</strong><small>${id==='print'?'Built into iPhone':files[id]?`${files[id].source==='download'?'Available offline':'Uploaded'} · ${esc(files[id].name)}`:'Downloads automatically when applied'}</small></span></label><div class="font-size-row"><div class="font-size-label"><label for="font-scale-${id}">Relative size</label><output id="font-scale-value-${id}" for="font-scale-${id}">${scaleText(sizes.fontScales[id])}</output></div><input id="font-scale-${id}" data-font-scale-id="${id}" type="range" min="${FONT_SCALE_MIN}" max="${FONT_SCALE_MAX}" step="0.01" value="${sizes.fontScales[id]}" aria-label="Relative size for ${esc(label)}"></div></div>`).join('')}</div>`).join('')}</div>`;
}
function fontSettingChanged(a,b){
 const left=normalizeTypographySettings(a),right=normalizeTypographySettings(b);
 return left.enabledFonts.length!==right.enabledFonts.length||left.enabledFonts.some(id=>!right.enabledFonts.includes(id))||
  left.fontMasterScale!==right.fontMasterScale||FONT_IDS.some(id=>left.fontScales[id]!==right.fontScales[id]);
}
function updateDraftFontButtons(){
 const dirty=fontSettingChanged(pendingFont||lastAcceptedFont,lastAcceptedFont);
 const apply=$('#apply-font'),cancel=$('#discard-font'),status=$('#font-draft-status');
 if(apply)apply.disabled=!dirty||applyingFont;
 if(cancel)cancel.disabled=!dirty||applyingFont;
 if(status)status.textContent=dirty?'Pending changes — tap Apply to validate and save.':'Current font selection and sizes are applied.';
}
function setPendingFont(id,checked){
 if(!FONT_IDS.includes(id))return;
 const draft=cloneFont(pendingFont||lastAcceptedFont);
 draft.enabledFonts=checked?[...new Set([...draft.enabledFonts,id])]:draft.enabledFonts.filter(x=>x!==id);
 draft.enabledFonts=FONT_IDS.filter(x=>draft.enabledFonts.includes(x));
 pendingFont=draft;++fontSelectionCounter;
 updateDraftFontButtons();
}
function setPendingFontScale(id,value){
 if(id!==null&&!FONT_IDS.includes(id))return;
 const draft=cloneFont(pendingFont||lastAcceptedFont);
 const n=Number(value);
 if(!Number.isFinite(n))return;
 if(id===null)draft.fontMasterScale=Math.min(MASTER_SCALE_MAX,Math.max(MASTER_SCALE_MIN,Math.round(n*100)/100));
 else draft.fontScales[id]=Math.min(FONT_SCALE_MAX,Math.max(FONT_SCALE_MIN,Math.round(n*100)/100));
 pendingFont=draft;++fontSelectionCounter;
 const out=$(id===null?'#font-master-size-value':`#font-scale-value-${id}`);
 if(out)out.textContent=scaleText(id===null?draft.fontMasterScale:draft.fontScales[id]);
 updateDraftFontButtons();
}
async function applyPendingFont(){
 if(applyingFont)return;
 const candidate=cloneFont(pendingFont||lastAcceptedFont);
 if(!fontSettingChanged(candidate,lastAcceptedFont))return;
 applyingFont=true;const seq=++fontSelectionCounter;
 try{
  const label=$('#font-draft-status');if(label)label.textContent='Checking selected fonts / downloading missing files…';
  const check=await verifyFontSelection(candidate);
  if(seq!==fontSelectionCounter)return;
  if(!check.ok){pendingFont=cloneFont(lastAcceptedFont);render();fontUnavailableDialog(candidate,check);return;}
  const saved=await change(d=>{Object.assign(d.settings,candidate);delete d.settings.fontDifficulty;delete d.settings.fontChoice;});
  if(saved){lastAcceptedFont=cloneFont(candidate);pendingFont=cloneFont(candidate);render();}
  else{pendingFont=cloneFont(lastAcceptedFont);render();}
 }finally{
  applyingFont=false;
  const apply=$('#apply-font');if(apply)apply.disabled=!fontSettingChanged(pendingFont||lastAcceptedFont,lastAcceptedFont);
 }
}
function discardPendingFont(){++fontSelectionCounter;pendingFont=cloneFont(lastAcceptedFont);render();}

const app=$('#app'),toastNode=$('#toast');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shapes={
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-8h6v8"/>',
 cards:'<rect x="5" y="4" width="15" height="17" rx="3"/><path d="M9 8h7M9 12h7M4 8H3M4 12H3"/>',
 chart:'<path d="M4 20V10M10 20V4M16 20v-8M22 20V7"/>',
 settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M19 13.5a7 7 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2.6-1.5L13.5 2h-4l-.5 3a7 7 0 0 0-2.6 1.5l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2.6 1.5l.5 3h4l.5-3a7 7 0 0 0 2.6-1.5l2.4 1 2-3.5z"/>',
 archive:'<path d="M4 5h16v5H4zM5 10v10h14V10M10 14h4"/>',
 download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 upload:'<path d="M12 21V8m-5 5 5-5 5 5M4 7V3h16v4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 right:'<path d="m9 5 7 7-7 7"/>',
 x:'<path d="M5 5 19 19M19 5 5 19"/>',
 spark:'<path d="m12 2 2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1z"/>',
 flame:'<path d="M12 22c4.8 0 7.5-3.8 7.5-8.5 0-4.1-3.1-6.7-4-7.5.5 4.1-3 5.6-3 5.6C11.4 6.7 9.8 5 9 2 8 5.7 4.5 9.4 4.5 13.5 4.5 18.2 7.2 22 12 22z"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 refresh:'<path d="M20 11a8 8 0 0 0-14-5L3 9V3m0 6h6M4 13a8 8 0 0 0 14 5l3-3v6m0-6h-6"/>',
 book:'<path d="M12 7c-2-2-5-2-9-2v14c4 0 7 0 9 2m0-14c2-2 5-2 9-2v14c-4 0-7 0-9 2m0-14v14"/>',
 shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/>',
 edit:'<path d="m15 5 4 4M4 20l5-1 11-11a3 3 0 0 0-4-4L5 15z"/>',
 trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v7M14 11v7"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
 clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
 layers:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>'
};
const icon=name=>`<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${shapes[name]||shapes.spark}</svg>`;
const labelDate=value=>value?new Date(value).toLocaleString():'Never';
const formatDay=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dateKey=value=>formatDay(new Date(value));
const percent=n=>`${Math.round(n*100)}%`;
const ratingLabels=['Unseen','Again','Hard','Good','Easy'];
const ratingMeaning=['New','Forgot / incorrect','Recalled with difficulty','Recalled normally','Effortless recall'];
const opText=['>','>=','=','<=','<'];
let state=null,page='study',studyMode='words',revealed=false,toneSelections=[],lastFinished=null,grammarFeedback=null;
let currentModal=null,pendingBackupRevision=null,saving=false,toastTimer;
const filters={words:{search:'',tags:{},op:'>=',rating:'any'},grammar:{search:'',tags:{},knowledgeOp:'>=',knowledgeValue:0,usageOp:'>=',usageValue:0}};
let lookupCache=null;
function lookups(){
 if(lookupCache?.cards===state.cards&&lookupCache?.grammar===state.grammar)return lookupCache;
 lookupCache={cards:state.cards,grammar:state.grammar,
  words:new Map(state.cards.map(c=>[c.id,c])),sentences:new Map(state.grammar.map(g=>[g.id,g]))};
 return lookupCache;
}
const wordById=id=>lookups().words.get(id);
const grammarById=id=>lookups().sentences.get(id);
const isDue=(id,now=Date.now())=>!!state.schedules[id]&&Date.parse(state.schedules[id].dueAt)<=now;
const countDue=()=>state.cards.filter(c=>isDue(c.id)).length;
const countLearned=()=>state.cards.filter(c=>state.schedules[c.id]?.reps>0).length;
const countNew=()=>state.cards.length-countLearned();
const backupNeeded=()=>state.revision>state.backedUpRevision;
const countReadyGrammar=()=>modeCounts(state,'grammar').available;
const recall=s=>s?(retrievability(s)??0):0;
const scoreWord=c=>wordKnowledge(state.schedules[c.id],recall(state.schedules[c.id]));
const scoreGrammar=g=>grammarScores(g,state.cards,state.schedules,recall,state.grammarHistory);
const topicTagCache={words:null,grammar:null};
const tagsFor=kind=>{
 const cached=topicTagCache[kind];
 if(cached?.cards===state.cards&&(kind==='words'||cached.grammar===state.grammar))return cached.tags;
 const tags=tagNodes((kind==='words'?state.cards.map(c=>c.tags):state.grammar.map(g=>grammarTags(g,state.cards))).flat()).map(n=>n.path);
 topicTagCache[kind]={cards:state.cards,grammar:state.grammar,tags};return tags;
};
const expandedTags={words:new Set(),grammar:new Set(),study:new Set()};
const studyFilters={tags:{},search:''};let selectedPool='all',studyComposing=false;
let tagOddsCache=null,tagContentRevision=0;
function invalidateTagOdds(){tagOddsCache=null;tagContentRevision++;}
function appliedNewWordOdds(){
 const weights=state.settings.tagWeights;
 if(tagOddsCache?.cards===state.cards&&tagOddsCache?.schedules===state.schedules&&tagOddsCache?.weights===weights&&tagOddsCache?.revision===tagContentRevision)return tagOddsCache.value;
 const value=newWordOdds(state.cards,state.schedules,weights);
 tagOddsCache={cards:state.cards,schedules:state.schedules,weights,revision:tagContentRevision,value};
 return value;
}

const tagHtml=text=>`<span class="tag">#${esc(tagLabel(text))}</span>`;
function toast(message){clearTimeout(toastTimer);toastNode.textContent=message;toastNode.classList.add('show');toastTimer=setTimeout(()=>toastNode.classList.remove('show'),3600);}
async function change(mutator,shouldRender=true,contentChange=false){
  if(saving)return false;
  saving=true;
  // Only copy learning records for a study action. Full dictionary data is
  // immutable unless an explicit add/edit/delete/master operation requests it.
  const draft=cloneProgressState(state,contentChange);
  try{mutator(draft);draft.appVersion=APP_VERSION;draft.revision=(draft.revision||0)+1;await saveState(draft,state.revision);state=draft;if(shouldRender)render();return true;}
  catch(error){toast(`Not saved: ${error.message}`);return false;}
  finally{saving=false;}
}
function shell(content){
  const nav=[['study','cards','Study'],['browse','book','Words'],['grammar','layers','Grammar'],['stats','chart','Stats']];
  const hideNav=page==='complete'||!!state.activePractice||(page==='study'&&(state.activeSession||state.activeGrammarSession));
  return `<header class="topbar"><div class="brand"><span class="brand-mark">词</span><span>Cíyán<small>Words that stay</small></span></div><div class="header-actions">
      <button class="icon-btn" data-action="backup" aria-label="Backup progress">${icon('archive')}${backupNeeded()?'<span class="dot"></span>':''}</button>
      <button class="icon-btn" data-action="navigate" data-page="settings" aria-label="Settings">${icon('settings')}</button></div></header>
      <main id="main">${content}</main>${hideNav?'':`<nav class="bottom-nav" aria-label="Main navigation">${nav.map(([dest,ico,title])=>
      `<button class="nav-item ${page===dest?'active':''}" data-action="navigate" data-page="${dest}" aria-label="${title}" ${page===dest?'aria-current="page"':''}>${icon(ico)}<span>${title}</span></button>`).join('')}</nav>`}`;
}
function backupBanner(){return backupNeeded()?`<div class="backup-banner">${icon('shield')}<p><strong>Changes not backed up.</strong> Your study data is saved locally. Export it to Files to protect it.</p><button data-action="backup">Backup</button></div>`:'';}
function availableWordQueue(){
  const due=state.cards.filter(c=>isDue(c.id)).sort((a,b)=>Date.parse(state.schedules[a.id].dueAt)-Date.parse(state.schedules[b.id].dueAt));
  const fresh=state.cards.filter(c=>!state.schedules[c.id]);
  const size=state.settings.sessionSize;
  const dueCap=Math.max(1,Math.floor(size*.7));
  const mix=[...due.slice(0,dueCap),...fresh.slice(0,size-dueCap),...due.slice(dueCap),...fresh.slice(Math.max(0,size-dueCap))];
  return [...new Set(mix.map(c=>c.id))].slice(0,size);
}
async function startSession(mode='words'){
  if(state.activePractice){page='study';render();return;}
  if(!state.activeSession&&!state.activeGrammarSession)return startPractice(mode);
  if(state.activeSession||state.activeGrammarSession){studyMode=state.activeGrammarSession?'grammar':'words';page='study';revealed=false;toneSelections=[];render();return;}
  if(mode==='grammar'){
    const ready=state.grammar.filter(g=>scoreGrammar(g).ready);
    if(!ready.length){studyMode='grammar';page='study';render();toast('Review the sentence words first to unlock grammar practice.');return;}
    // Least-practiced first, then cycle through the unlocked examples.
    const queue=ready.sort((a,b)=>state.grammarHistory.filter(h=>h.grammarId===a.id).length-state.grammarHistory.filter(h=>h.grammarId===b.id).length)
      .slice(0,state.settings.sessionSize).map(g=>g.id);
    const session={id:crypto.randomUUID(),startedAt:new Date().toISOString(),queue,initialTotal:queue.length,results:[],correct:0,picks:[]};
    if(await change(d=>{d.activeGrammarSession=session;},false)){studyMode='grammar';page='study';grammarFeedback=null;render();}
  }else{
    const queue=availableWordQueue();
    if(!queue.length){page='study';studyMode='words';render();toast('No words are due now.');return;}
    const session={id:crypto.randomUUID(),startedAt:new Date().toISOString(),queue,initialTotal:queue.length,results:[],newWords:0,correct:0};
    if(await change(d=>{d.activeSession=session;},false)){studyMode='words';page='study';revealed=false;toneSelections=[];render();}
  }
}
function wordToneCheck(c){
  if(!state.settings.toneTest)return null;
  const expected=toneTargets(c.hanzi,c.pinyin);
  if(!expected)return null;
  const chosen=expected.map((_,i)=>toneSelections[i]||0);
  return {expected,chosen,wrong:expected.flatMap((t,i)=>t===chosen[i]?[]:[i])};
}
async function gradeCard(grade){
  if(saving||!revealed||!state.activeSession?.queue.length)return;
  const id=state.activeSession.queue[0],card=wordById(id),tone=wordToneCheck(card);
  if(grade===4&&state.settings.enforceTones&&tone?.wrong.length){toast('Tone mismatch: Easy is unavailable. Choose Good or lower.');return;}
  const previous=state.schedules[id]||null,now=Date.now(),after=scheduleReview(previous,grade,now,state.settings);
  const first=!previous,completed=state.activeSession.queue.length<=1;
  const done=await change(d=>{
    d.schedules[id]=after;
    d.history.push({id:crypto.randomUUID(),cardId:id,at:new Date(now).toISOString(),grade,first,previousDueAt:previous?.dueAt||null,
      nextDueAt:after.dueAt,score:after.score,model:MODEL,toneResult:tone?{expected:tone.expected,selected:tone.chosen,correct:tone.wrong.length===0}:null});
    const active=d.activeSession;
    active.results.push({cardId:id,grade});active.queue.shift();if(first)active.newWords++;if(grade>=3)active.correct++;
    if(completed){lastFinished={mode:'words',id:active.id,startedAt:active.startedAt,endedAt:new Date(now).toISOString(),total:active.results.length,
      newWords:active.newWords,correct:active.correct,results:active.results};d.sessions.push(lastFinished);d.activeSession=null;}
  },false);
  if(done){revealed=false;toneSelections=[];page=completed?'complete':'study';render();}
}
async function finishEarly(){
  const g=!!state.activeGrammarSession,s=g?state.activeGrammarSession:state.activeSession;
  if(!s)return;
  if(!s.results.length){if(await change(d=>{if(g)d.activeGrammarSession=null;else d.activeSession=null;},false)) {page='study';render();}return;}
  const finished={mode:g?'grammar':'words',id:s.id,startedAt:s.startedAt,endedAt:new Date().toISOString(),total:s.results.length,
    newWords:g?0:s.newWords,correct:s.correct,results:s.results};
  const done=await change(d=>{if(g){d.grammarSessions.push(finished);d.activeGrammarSession=null;}else{d.sessions.push(finished);d.activeSession=null;}},false);
  if(done){lastFinished=finished;grammarFeedback=null;page='complete';render();}
}
function studyFilterTree(){
 const tags=tagsFor('words'),nodes=tagNodes(tags),selected=Object.entries(studyFilters.tags).filter(([,v])=>v);
 const visible=nodes.filter(n=>n.path.split('/').slice(0,-1).every((_,i)=>expandedTags.study.has(n.path.split('/').slice(0,i+1).join('/'))));
 return `<section class="panel stack study-filter-panel"><div class="row"><h2>Session filters</h2><button class="text-link" data-action="study-clear-filters">Reset</button></div><p class="subtle">A word must match the chosen tags. A grammar or particle exercise needs only one matching word with score ≥ 2.0; other words don't exclude the sentence.</p><label class="search-field">${icon('search')}<input id="study-search" placeholder="Search words or tags…" value="${esc(studyFilters.search)}" autocomplete="off"></label><div class="active-tags">${selected.map(([t,v])=>`<button class="pill ${v===1?'include':'exclude'}" data-action="study-tag" data-tag="${esc(t)}">${v===1?'✓':'−'} ${esc(tagLabel(t))}</button>`).join('')||'<span class="subtle">All topics included</span>'}</div><div class="tag-tree">${visible.map(n=>{const children=tags.some(t=>t.startsWith(n.path+'/')),v=studyFilters.tags[n.path]||0;
  return `<div class="tag-tree-row" style="padding-left:${n.depth*18}px">${children?`<button class="tree-toggle" data-action="study-expand-tag" data-tag="${esc(n.path)}" aria-expanded="${expandedTags.study.has(n.path)}" aria-label="Expand ${esc(tagLabel(n.label))}">${expandedTags.study.has(n.path)?'▾':'▸'}</button>`:'<span class="tree-spacer"></span>'}<button class="tree-label ${v===1?'include':v===-1?'exclude':''}" data-action="study-tag" data-tag="${esc(n.path)}" aria-label="${esc(n.path)}: ${v===1?'required':v===-1?'excluded':'neutral'}">${v===1?'✓':v===-1?'−':'○'} ${esc(tagLabel(n.label))}</button></div>`;}).join('')}</div><p class="subtle">Tap tag to require → exclude → neutral. Expand branches with arrows. Filters apply only to the session, not your backup.</p></section>`;
}
function selectedCount(counts,pool=selectedPool){return pool==='due'?counts.due:pool==='new'?counts.new:counts.available;}
function studySummary(mode,counts=modeCounts(state,mode,studyFilters)){return `<div class="study-counts"><span><strong>${counts.due}</strong><small>Due now</small></span><span><strong>${counts.started}</strong><small>Started · not due</small></span><span><strong>${selectedCount(counts)}</strong><small>Available to study</small></span></div><p class="subtle">${counts.new} new available${mode==='words'?` of ${counts.newTotal} unstarted matching words`: ''} · ${counts.blocked} excluded or awaiting prerequisites</p>`;}
function renderStudyIntro(){
 const today=newVocabToday(state),left=newVocabRemaining(state),countsByMode=Object.fromEntries(Object.keys(MODES).map(m=>[m,modeCounts(state,m,studyFilters)])),enabled=Object.keys(MODES).filter(m=>state.settings.autoModes[m]),all=enabled.map(m=>countsByMode[m]);
 const due=all.reduce((n,x)=>n+x.due,0),newCards=all.reduce((n,x)=>n+x.new,0);
 return `<div class="page-heading"><div class="eyebrow">STUDY · YOUR HOME</div><h1 class="h1">Learn it.<br>Then use it.</h1><p class="lead">Continuous recognition, grammar, character writing, and particles. Stop whenever you choose.</p></div>
 <section class="panel stack study-pool"><h2>Choose what is eligible</h2><div class="study-pool-options">${[['all','All'],['due','Due only'],['new','New only']].map(([p,label])=>`<button class="btn ${selectedPool===p?'btn-primary':'btn-secondary'}" data-action="study-pool" data-pool="${p}" aria-pressed="${selectedPool===p}">${label}</button>`).join('')}</div><p class="subtle">All: review due cards first, then introduce new exercises. Due only never introduces cards; New only never asks scheduled reviews.</p><p class="subtle">New vocabulary today: ${today}${Number.isFinite(left)?` · ${left} introductions remaining`:' · Unlimited introductions'}</p></section>
 ${autoControls()}<div class="mode-grid">${Object.entries(MODES).map(([mode,name])=>{const c=countsByMode[mode];return `<section class="panel mode-panel"><h2>${name}</h2>${studySummary(mode,c)}<button class="btn btn-secondary btn-full" data-action="practice-start" data-mode="${mode}" ${!modeStartable(mode,c)?'disabled':''}>Study ${name.toLowerCase()}</button></section>`;}).join('')}</div>
 ${backupBanner()}${studyFilterTree()}`;
}
function modeStartable(mode,counts){
 const permitted=selectedCount(counts);
 if(!permitted)return false;
 if(mode==='words'&&selectedPool==='new'&&newVocabRemaining(state)<=0)return false;
 if(mode==='words'&&selectedPool==='all'&&!counts.due&&newVocabRemaining(state)<=0)return false;
 return true;
}
function renderToneGrid(c){
  const expected=toneTargets(c.hanzi,c.pinyin);
  if(!expected)return `<div class="notice warning" style="margin-top:12px">Tone input unavailable: syllables cannot be matched to this card's characters. Easy is not restricted for this card.</div>`;
  const chars=[...c.hanzi].filter(ch=>/\p{Script=Han}/u.test(ch));
  return `<div class="tone-intro">Choose tones for each character (leave all unchecked for neutral / tone 0)</div>
    <div class="tone-grid">${chars.map((char,i)=>`<div class="tone-column"><div class="tone-char">${esc(char)}</div>
      ${[1,2,3,4].map(t=>`<label class="tone-option ${toneSelections[i]===t?'selected':''}"><input type="checkbox" data-tone-index="${i}" data-tone-value="${t}" ${toneSelections[i]===t?'checked':''} ${revealed?'disabled':''} aria-label="${char} tone ${t}"/><span>${t}</span></label>`).join('')}</div>`).join('')}</div>`;
}
function renderWordStudy(){
  const s=state.activeSession,card=wordById(s.queue[0]);if(!card)return '<div class="empty">Missing word. Try ending the session.</div>';
  const processed=s.results.length,previous=state.schedules[card.id],intervals=previewIntervals(previous,Date.now(),state.settings);
  const tone=wordToneCheck(card),badTone=!!tone?.wrong.length;
  const ratingOptions=[['again','Again',1],['hard','Hard',2],['good','Good',3],['easy','Easy',4]];
  return `<div class="review-top"><button class="icon-btn" data-action="finish-prompt" aria-label="End session">${icon('x')}</button>
    <div class="review-progress"><span style="width:${100*processed/s.initialTotal}%"></span></div><span class="review-note">${processed+1} / ${s.initialTotal}</span></div>
    <div class="review-card ${state.settings.toneTest?'tone-review':''}" ${revealed||state.settings.toneTest?'':'data-action="reveal" role="button" tabindex="0" aria-label="Reveal answer"'}>
      <div class="card-kicker">${previous?'REVIEW WORD':'NEW WORD'} · CHINESE → ENGLISH</div>
      ${card.tags.length?`<span class="review-tag">${tagHtml(card.tags[0])}</span>`:''}
      ${state.settings.toneTest?renderToneGrid(card):`<div class="review-hanzi">${esc(card.hanzi)}</div>`}
      ${(revealed||(!state.settings.toneTest&&state.settings.showPinyinPrompt))&&card.pinyin?`<div class="review-pinyin">${esc(card.pinyin)}</div>`:''}
      ${revealed?`<div class="review-english">${esc(card.english)}</div>
        ${tone?`<div class="tone-result ${badTone?'incorrect':'correct'}">${badTone?`Tone mismatch (${tone.wrong.length} of ${tone.expected.length}): expected ${tone.expected.join(' · ')}; selected ${tone.chosen.join(' · ')}.`:'Tones matched!'}${badTone&&state.settings.enforceTones?' Easy is capped at Good.':''}</div>`:''}
        <button class="text-link" data-action="card-detail" data-id="${esc(card.id)}" style="margin-top:15px">View in-context sentences ${icon('right')}</button>`:
        `<div class="review-prompt">Remember the meaning${state.settings.toneTest?' and select tones':''}, then reveal</div>`}</div>
    ${revealed?`<section class="panel stack vocab-context"><div class="eyebrow">IN CONTEXT</div>${contextsForWord(state,card).map(m=>{const g=m.grammar;return `<div class="vocab-example"><strong>${esc(plainSentence(g.markup))}</strong><p>${esc(g.pinyin)}</p><p>${esc(g.english)}</p>${matchTrace(m)}</div>`;}).join('')||'<p class="subtle">No linked grammar examples.</p>'}</section>`:''}
    ${revealed?`<div class="eyebrow" style="text-align:center">HOW WELL DID YOU REMEMBER?</div><div class="review-controls">${ratingOptions.map(([cls,label,grade],i)=>
      `<button class="grade ${cls}" data-action="grade" data-grade="${grade}" ${grade===4&&state.settings.enforceTones&&badTone?'disabled':''}><strong>${label}</strong><span>${intervals[i]}</span></button>`).join('')}</div>
      <p class="study-captions">Again: forgot · Hard: struggled · Good: recalled · Easy: effortless</p>`:
      `<button class="btn btn-primary btn-full" data-action="reveal">Reveal answer ${icon('right')}</button>`}
    <div class="study-actions"><span class="subtle">${countDue()} due in your collection</span><button class="text-link" data-action="finish-prompt">Finish early</button></div>
    <p class="study-captions">Each answer is saved automatically · Export at session end</p>`;
}
function shuffledBank(grammar,session){
  const words=parseSegments(grammar.markup).filter(s=>s.type==='token').map(s=>({id:`t${s.index}`,word:s.text}));
  const distractors=grammar.distractors.map((d,i)=>({id:`d${i}`,word:d.word}));
  const all=[...words,...distractors];
  let seed=0;for(const char of `${session.id}:${grammar.id}`)seed=(seed*31+char.charCodeAt(0))>>>0;
  for(let i=all.length-1;i>0;i--){seed=(1664525*seed+1013904223)>>>0;const j=seed%(i+1);[all[i],all[j]]=[all[j],all[i]];}
  return all;
}
function buildSentence(grammar,picks,feedback=false){
  return parseSegments(grammar.markup).map(seg=>{
    if(seg.type==='fixed')return `<span class="sentence-punct">${esc(seg.text)}</span>`;
    const id=picks[seg.index]||'',bank=[...parseSegments(grammar.markup).filter(s=>s.type==='token').map(s=>({id:`t${s.index}`,word:s.text})),...grammar.distractors.map((d,i)=>({id:`d${i}`,word:d.word}))];
    const value=bank.find(x=>x.id===id)?.word||'';
    const wrong=feedback&&grammarMistakes(grammar,picks).includes(seg.index);
    return `<button class="sentence-slot ${id?'filled':''} ${wrong?'incorrect':''}" data-action="grammar-slot" data-slot="${seg.index}" data-drop-slot="${seg.index}" ${feedback?'disabled':''} draggable="${!!id&&!feedback}" aria-label="Word slot ${seg.index+1}${value?': '+value:''}">${value?esc(value):`<span>${seg.index+1}</span>`}</button>`;
  }).join('');
}
function renderGrammarStudy(){
  if(grammarFeedback){
    const f=grammarFeedback,g=f.grammar;
    return `<div class="eyebrow" style="margin-top:25px">SENTENCE RESULT</div><h1 class="h1">${f.correct?'Nicely assembled.':'One to revisit.'}</h1>
      <p class="lead">${f.correct?'Correct ordering and word choice.':'Compare the highlighted words with the target sentence. Other natural Chinese word orders may exist.'}</p>
      <div class="panel stack" style="margin:22px 0"><div class="eyebrow">YOUR ANSWER</div><div class="grammar-sentence">${buildSentence(g,f.picks,true)}</div>
        <div class="eyebrow">CORRECT SENTENCE</div><div class="grammar-sentence sentence-answer">${esc(plainSentence(g.markup))}</div>
        <div class="subtle">${esc(g.pinyin)}</div><strong>${esc(g.english)}</strong></div>
      <button class="btn btn-primary btn-full" data-action="next-grammar">${state.activeGrammarSession?'Next sentence':'Session summary'} ${icon('right')}</button>`;
  }
  const s=state.activeGrammarSession,g=grammarById(s.queue[0]);if(!g)return '<div class="empty">Missing grammar example. End this session to continue.</div>';
  const bank=shuffledBank(g,s),tokens=parseSegments(g.markup).filter(x=>x.type==='token'),picks=s.picks||[];
  const chosen=new Set(picks.filter(Boolean));
  return `<div class="review-top"><button class="icon-btn" data-action="finish-prompt" aria-label="End session">${icon('x')}</button>
      <div class="review-progress"><span style="width:${100*s.results.length/s.initialTotal}%"></span></div>
      <span class="review-note">${s.results.length+1} / ${s.initialTotal}</span></div>
    <div class="grammar-puzzle"><div class="eyebrow">GRAMMAR LAB · ENGLISH → CHINESE</div>
      <h2>${esc(g.english)}</h2><p class="subtle">Tap the tiles in order, or drag them to a slot. Tap a placed tile to remove it.</p>
      <div class="grammar-sentence" aria-label="Sentence composition">${buildSentence(g,picks)}</div>
      <div class="eyebrow" style="margin:20px 0 9px">WORD BANK · ${bank.length-tokens.length} DISTRACTOR${bank.length-tokens.length===1?'':'S'}</div>
      <div class="grammar-bank">${bank.map(tile=>`<button class="bank-tile ${chosen.has(tile.id)?'used':''}" data-action="grammar-pick" data-tile="${esc(tile.id)}" draggable="${!chosen.has(tile.id)}" ${chosen.has(tile.id)?'disabled':''}>${esc(tile.word)}</button>`).join('')}</div>
    </div><button class="btn btn-primary btn-full" data-action="grammar-check" ${picks.filter(Boolean).length!==tokens.length?'disabled':''}>Check sentence ${icon('check')}</button>
    <div class="study-actions"><span class="subtle">${countReadyGrammar()} unlocked grammar cards</span><button class="text-link" data-action="finish-prompt">Finish early</button></div>
    <p class="study-captions">Choose carefully: similar-looking words may be incorrect here. This mode checks the card’s target word order.</p>`;
}
function renderStudy(){
  if(state.activePractice)return practiceRender();
  if(state.activeGrammarSession||grammarFeedback)return renderGrammarStudy();
  if(state.activeSession)return renderWordStudy();
  return renderStudyIntro();
}
function renderComplete(){
  const s=lastFinished||[...state.sessions,...state.grammarSessions,...state.mixedSessions].sort((a,b)=>Date.parse(a.endedAt)-Date.parse(b.endedAt)).at(-1);
  if(!s)return '<div class="empty">No completed session yet.</div>';
  const grammar=s.mode==='grammar';
  return `<div class="eyebrow" style="text-align:center;margin-top:34px">SESSION COMPLETE</div>
    <div class="complete-art"><span class="big-symbol">好</span></div><h1 class="complete-title">You showed up.<br>That matters.</h1>
    <p class="complete-subtitle">${grammar?'Sentence practice turns familiar words into useful Chinese.':'Every word you practice makes the next conversation easier.'}</p>
    <div class="complete-stats"><div><strong>${s.total}</strong><span>${grammar?'Sentences':'Reviewed'}</span></div>
      <div><strong>${grammar?countReadyGrammar():s.newWords}</strong><span>${grammar?'Unlocked':'New words'}</span></div>
      <div><strong>${s.total?Math.round(100*s.correct/s.total):0}%</strong><span>${grammar?'Correct':'Good / Easy'}</span></div></div>
    ${state.lastPracticeUndo?'<button class="btn btn-secondary btn-full" data-action="undo-completed">Undo last answer</button>':''}<div class="panel stack"><div class="row"><strong>${icon('shield')} Protect your progress</strong><span class="tag alt">Important</span></div>
      <p class="lead" style="font-size:13px">Your reviews are saved locally, but only a separate JSON file in Files protects against browser storage loss.</p>
      <button class="btn btn-primary btn-full" data-action="backup">${icon('download')}Save progress to Files</button>
      ${backupNeeded()?'<div class="notice warning">Your latest reviews have not been confirmed as backed up.</div>':'<div class="notice">Your current changes are marked as backed up.</div>'}
      <button class="btn btn-secondary btn-full" data-action="navigate" data-page="study">Study again</button>
      <button class="text-link" data-action="navigate" data-page="study" style="text-align:center">Back to Study</button></div>`;
}
function compare(a,op,b){switch(op){case '>':return a>b;case '>=':return a>=b;case '=':return a===b;case '<=':return a<=b;case '<':return a<b;default:return true;}}
function options(values,selected){return values.map(([value,label])=>`<option value="${esc(value)}" ${String(selected)===String(value)?'selected':''}>${esc(label)}</option>`).join('');}
const compareOptions=selected=>options(opText.map(op=>[op,op]),selected);
function renderCollection(kind){
  const grammar=kind==='grammar',f=filters[kind];
  return `<div class="page-heading"><div class="eyebrow">${grammar?'SENTENCE COLLECTION':'YOUR WORD GARDEN'}</div>
    <div class="headline-row"><div><h1 class="h1">${grammar?'Words in<br>context.':'Every word<br>has a story.'}</h1><p class="lead">${grammar?'Browse, edit, and explore grammar sentences.':'Search, collect, and grow your vocabulary.'}</p></div>
      <button class="icon-btn" data-action="new-entry" data-kind="${kind}" aria-label="Add ${grammar?'grammar':'word'}" style="margin-top:12px">${icon('plus')}</button></div></div>
    <label class="search-field">${icon('search')}<input id="collection-search" placeholder="Search Chinese, English, pinyin, tags…" value="${esc(f.search)}" autocomplete="off"></label>
    <div class="section-row compact"><strong class="subtle">TOPIC FILTERS</strong><button class="text-link" data-action="reset-tags" data-kind="${kind}">Reset tags</button></div>
    <div id="active-tag-filter" class="active-tags"></div><div id="tag-filter" class="tag-tree"></div>
    <div class="filter-controls">${grammar?`<div class="filter-line"><span>Knowledge</span>
       <select aria-label="Knowledge comparison" data-filter="knowledgeOp" data-kind="grammar">${compareOptions(f.knowledgeOp)}</select>
       <select aria-label="Knowledge percentage" data-filter="knowledgeValue" data-kind="grammar">${options(Array.from({length:21},(_,i)=>[i*5,`${i*5}%`]),f.knowledgeValue)}</select></div>
       <div class="filter-line"><span>Usage risk</span>
       <select aria-label="Usage comparison" data-filter="usageOp" data-kind="grammar">${compareOptions(f.usageOp)}</select>
       <select aria-label="Usage percentage" data-filter="usageValue" data-kind="grammar">${options(Array.from({length:21},(_,i)=>[i*5,`${i*5}%`]),f.usageValue)}</select></div>`:
       `<div class="filter-line"><span>Last rating</span>
       <select aria-label="Rating comparison" data-filter="op" data-kind="words">${compareOptions(f.op)}</select>
       <select aria-label="Rating filter" data-filter="rating" data-kind="words">${options([['any','Any'],...ratingLabels.map((r,i)=>[i,r])],f.rating)}</select></div>`}</div>
    ${grammar?`<p class="subtle">Knowledge is estimated from the sentence's vocabulary. Usage risk is the error rate over the last 20 checked attempts at this sentence. No attempts means no evidence; this is not a measure of overall Mandarin proficiency. Combined ranking = knowledge × (1 − usage risk).</p>`:
       `<p class="subtle">Again, Hard, Good, and Easy are review ratings, not linear learning stages. Filtering compares each word's <strong>most recent rating</strong>; Unseen is 0.</p>`}
    <div class="row" style="margin:15px 0 12px"><div id="browse-count" class="filter-count"></div>
      <button class="text-link" data-action="new-entry" data-kind="${kind}">${icon('plus')} Add ${grammar?'sentence':'word'}</button></div>
    ${!grammar?'<button class="btn btn-secondary btn-full" data-action="study-filtered">Study matching words</button>':''}<div id="collection-list"></div>${backupBanner()}`;
}
const matchesTags=matchesTagFilters;
const COLLECTION_SIZE=20;
const collectionPages={words:0,grammar:0};
const collectionSearchCache={words:null,grammar:null};
function collectionResults(kind,f,q){
 const key=JSON.stringify([state.revision,f,q,formatDay()]);
 const previous=collectionSearchCache[kind];
 if(previous?.key===key&&previous.cards===state.cards&&previous.grammar===state.grammar)return previous.results;
 let results;
 if(kind==='words'){
  results=state.cards.filter(c=>matchesTags(c.tags,f.tags)&&
    (f.rating==='any'||compare(state.schedules[c.id]?.lastRating||0,f.op,Number(f.rating)))&&
    (!q||[c.hanzi,c.pinyin,c.english,...c.tags].join(' ').toLowerCase().includes(q)));
 }else{
  const readyIds=new Set(modeCounts(state,'grammar').eligible.map(item=>item.id));
  results=state.grammar.map(g=>({g,score:scoreGrammar(g),tags:grammarTags(g,state.cards)}))
    .filter(({g,score,tags})=>matchesTags(tags,f.tags)&&compare(Math.round(score.knowledge*100),f.knowledgeOp,Number(f.knowledgeValue))&&
      compare(Math.round(score.usage*100),f.usageOp,Number(f.usageValue))&&
      (!q||[plainSentence(g.markup),g.markup,g.english,g.pinyin,...tags].join(' ').toLowerCase().includes(q)))
    .sort((a,b)=>b.score.combined-a.score.combined||a.g.english.localeCompare(b.g.english))
    .map(({g,score,tags})=>({g,score,tags,ready:readyIds.has(g.id)}));
 }
 collectionSearchCache[kind]={key,cards:state.cards,grammar:state.grammar,results};return results;
}
function pageControl(kind,number,total){
 const pages=Math.max(1,Math.ceil(total/COLLECTION_SIZE)),current=number+1;
 const control=(title,dir,disabled)=>`<button type="button" class="collection-page-btn" data-action="collection-page" data-kind="${kind}" data-dir="${dir}" aria-label="${title}" ${disabled?'disabled':''}>${title}</button>`;
 return `<nav class="collection-pages" aria-label="${kind==='words'?'Vocabulary':'Grammar'} pages">
 ${control('« First','first',current===1)}${control('‹ Previous','prev',current===1)}
 <span class="collection-page-status">Page <strong>${current}</strong> of <strong>${pages}</strong><small>${total} matching · ${COLLECTION_SIZE} per page</small></span>
 ${control('Next ›','next',current>=pages)}${control('Last »','last',current>=pages)}
 </nav>`;
}
function updateCollection(keepPage=false){
 const kind=page==='grammar'?'grammar':'words',f=filters[kind],tags=tagsFor(kind);
 if(!keepPage)collectionPages[kind]=0;
 const positives=tags.filter(t=>f.tags[t]===1),negatives=tags.filter(t=>f.tags[t]===-1),active=[...positives,...negatives];
 const activeNode=$('#active-tag-filter'),availableNode=$('#tag-filter');if(!activeNode||!availableNode)return;
 activeNode.innerHTML=active.length?active.map(t=>`<button class="pill ${f.tags[t]===1?'include':'exclude'}" data-action="cycle-tag" data-kind="${kind}" data-tag="${esc(t)}">${f.tags[t]===1?'✓':'−'} # ${esc(tagLabel(t))}</button>`).join(''):
   '<span class="subtle">No active tags. Tap a topic to include it.</span>';
 availableNode.innerHTML=tagNodes(tags).filter(n=>{const parts=n.path.split('/');return parts.slice(0,-1).every((_,i)=>expandedTags[kind].has(parts.slice(0,i+1).join('/')));}).map(n=>{
    const children=tags.some(t=>t.startsWith(n.path+'/')),v=f.tags[n.path]||0;
    const inherited=Object.entries(f.tags).find(([t,value])=>value&&n.path.startsWith(t+'/'));
    return `<div class="tag-tree-row" style="padding-left:${n.depth*18}px">${children?`<button class="tree-toggle" data-action="expand-tag" data-kind="${kind}" data-tag="${esc(n.path)}" aria-label="Expand ${esc(tagLabel(n.label))}" aria-expanded="${expandedTags[kind].has(n.path)}">${expandedTags[kind].has(n.path)?'▾':'▸'}</button>`:'<span class="tree-spacer"></span>'}<button class="tree-label ${v===1?'include':v===-1?'exclude':''}" data-action="cycle-tag" data-kind="${kind}" data-tag="${esc(n.path)}" aria-label="${esc(n.path)}: ${v===1?'required':v===-1?'excluded':'neutral'}">${v===1?'✓':v===-1?'−':'○'} ${esc(tagLabel(n.label))}${!v&&inherited?`<small> · parent ${inherited[1]===1?'required':'excluded'}</small>`:''}</button></div>`;
 }).join('')+'<p class="subtle">Tap a label: require → exclude → neutral. Required tags all must match; parents include descendants. Exclusions win. Use arrows to expand.</p>';
 updateCollectionPage(kind);
 applyFontToRoot(activeNode,state.settings);applyFontToRoot(availableNode,state.settings);
}
function updateCollectionPage(kind=page==='grammar'?'grammar':'words'){
 const f=filters[kind],q=f.search.trim().toLowerCase(),results=collectionResults(kind,f,q),pages=Math.max(1,Math.ceil(results.length/COLLECTION_SIZE));
 collectionPages[kind]=Math.min(pages-1,Math.max(0,collectionPages[kind]));
 const begin=collectionPages[kind]*COLLECTION_SIZE,visible=results.slice(begin,begin+COLLECTION_SIZE);
 const countNode=$('#browse-count'),list=$('#collection-list');if(!countNode||!list)return;
 countNode.textContent=`${results.length} of ${kind==='words'?state.cards.length:state.grammar.length} ${kind==='words'?'words':'sentences'}`;
 let content='';
 if(kind==='words')content=visible.map(c=>{
  const schedule=state.schedules[c.id];
  return `<button class="list-card" data-action="card-detail" data-id="${esc(c.id)}"><div class="list-hanzi">${esc(c.hanzi)}<small>${esc(c.pinyin)}</small></div>
    <div class="list-detail"><strong>${esc(c.english)}</strong><small>${esc(c.tags.slice(0,3).map(x=>'#'+tagLabel(x)).join('  '))} · ${esc(dueLabel(schedule))}</small></div>
    <div class="list-meta"><strong>${percent(scoreWord(c))}</strong><small>${schedule?ratingLabels[schedule.lastRating]:'New'}</small></div>${icon('right')}</button>`;
 }).join('');
 else content=visible.map(({g,score,tags,ready})=>`<button class="list-card grammar-list" data-action="grammar-detail" data-id="${esc(g.id)}">
  <div class="list-detail"><strong class="grammar-preview">${esc(plainSentence(g.markup))}</strong><small>${esc(g.english)}</small>
  <small>${esc(tags.slice(0,4).map(t=>'#'+tagLabel(t)).join('  '))}</small></div><div class="list-meta"><strong>${percent(score.combined)}</strong>
  <small>${ready?'Ready':'Locked'}</small></div>${icon('right')}</button>`).join('');
 list.innerHTML=results.length?content+pageControl(kind,collectionPages[kind],results.length):`<div class="empty"><strong>No matching ${kind==='words'?'words':'sentences'}</strong>Adjust your search or filters.</div>`;
 applyFontToRoot(list,state.settings);
 applyFontToRoot(list,state.settings);
}

let reviewDayCache=null;
function reviewDayCounts(){
 const key=state.revision;
 if(reviewDayCache?.revision===key)return reviewDayCache.counts;
 const counts=new Map();
 for(const list of [state.history,state.grammarHistory,state.skillHistory])for(const h of list){
  if(!h?.at)continue;const day=dateKey(h.at);counts.set(day,(counts.get(day)||0)+1);
 }
 reviewDayCache={revision:key,counts};return counts;
}
function dailyStats(){const count=state.history.filter(h=>dateKey(h.at)===formatDay()).length;return `<section class="metrics stats-daily"><div class="metric">${icon('clock')}<div class="num">${countDue()}</div><div class="label">Vocabulary due now</div></div><div class="metric">${icon('book')}<div class="num">${countLearned()}</div><div class="label">Words encountered</div></div><div class="metric">${icon('flame')}<div class="num">${count}</div><div class="label">Vocab reviews today</div></div></section><p class="subtle">Master collection: ${state.cards.length} vocabulary words, ${state.grammar.length} grammar entries. ${countReadyGrammar()} grammar entries meet the new score thresholds.</p>`;}
function renderStats(){
  const total=state.history.length,good=state.history.filter(h=>h.grade>=3).length;
  const reviewCounts=reviewDayCounts();
  const days=new Set(reviewCounts.keys());
  const d=new Date();if(!days.has(formatDay(d)))d.setDate(d.getDate()-1);
  let streak=0;while(days.has(formatDay(d))){streak++;d.setDate(d.getDate()-1);}
  const series=Array.from({length:7},(_,i)=>{const day=new Date();day.setDate(day.getDate()-6+i);return {label:day.toLocaleDateString(undefined,{weekday:'short'}),day:formatDay(day),count:reviewCounts.get(formatDay(day))||0};});
  const max=Math.max(1,...series.map(x=>x.count));
  const seen=state.cards.filter(c=>state.schedules[c.id]);
  const strength=seen.length?seen.reduce((a,c)=>a+recall(state.schedules[c.id]),0)/seen.length:0;
  const grammarCorrect=state.grammarHistory.filter(h=>h.correct).length;
  const sessions=[...state.sessions,...state.grammarSessions,...state.mixedSessions].sort((a,b)=>Date.parse(b.endedAt)-Date.parse(a.endedAt));
  return `<div class="page-heading"><div class="eyebrow">THE LONG GAME</div><h1 class="h1">Look how far<br>you've come.</h1><p class="lead">A history of the words and sentences you have practiced.</p></div>${dailyStats()}
    ${extendedStats()}<div class="stat-overview"><div class="stat-block">${icon('book')}<strong>${countLearned()}</strong><span>Words encountered</span></div>
      <div class="stat-block">${icon('refresh')}<strong>${total}</strong><span>Vocab reviews</span></div>
      <div class="stat-block">${icon('layers')}<strong>${state.grammarHistory.length}</strong><span>Grammar attempts</span></div>
      <div class="stat-block">${icon('flame')}<strong>${streak} days</strong><span>Practice streak</span></div></div>
    <div class="section-row"><h2 class="section-title">This week</h2><span class="subtle">${series.reduce((a,x)=>a+x.count,0)} total practices</span></div>
    <div class="panel"><div class="eyebrow">ACTIVITY BY DAY</div><div class="week-bars">${series.map(x=>`<div class="bar-column" title="${x.count} practices"><div class="bar-fill" style="height:${Math.max(5,x.count/max*104)}px"></div><div class="bar-label">${esc(x.label)}</div></div>`).join('')}</div></div>
    <div class="section-row"><h2 class="section-title">Memory health</h2></div>
    <div class="panel"><div class="row"><div><strong>Estimated recall</strong><p class="subtle">${MODEL} retrievability for studied words</p></div><strong style="font-size:28px">${percent(strength)}</strong></div>
      <div class="progress-group"><div class="progress-track"><div class="progress-fill" style="width:${percent(strength)}"></div></div></div>
      <p class="subtle">${total?Math.round(100*good/total):0}% of vocabulary ratings were Good or Easy · ${state.grammarHistory.length?Math.round(100*grammarCorrect/state.grammarHistory.length):0}% grammar attempts correct.</p></div>
    <div class="section-row"><h2 class="section-title">Recent sessions</h2></div>
    ${sessions.length?sessions.slice(0,6).map(s=>`<div class="list-card"><span class="brand-mark" style="height:40px;width:40px;font-size:18px">${s.mode==='grammar'?'文':'词'}</span>
    <div class="list-detail"><strong>${new Date(s.endedAt).toLocaleDateString()}</strong><small>${esc(MODES[s.mode]||(s.mode==='auto'?'Auto Study':'Vocabulary'))} · ${s.total} attempts · ${s.total?Math.round(100*s.correct/s.total):0}% success</small></div></div>`).join(''):'<div class="empty">Your completed sessions will appear here.</div>'}`;
}
function renderSettings(){const s=state.settings,draft=pendingFont||lastAcceptedFont;
  return `<div class="page-heading"><div class="eyebrow">MAKE IT YOURS</div><h1 class="h1">Your practice,<br>your pace.</h1><p class="lead">Adjust the experience and keep your learning safe.</p></div>
${schedulerSettings()}${tagWeightSettings()}   <div class="section-row"><h2 class="section-title">Study preferences</h2></div>
   <div class="panel"><div class="settings-row"><div><strong>New vocabulary words per day</strong><small>Leave empty for unlimited. Zero blocks new words but not due reviews. Resets each local calendar day.</small></div><input type="number" min="0" max="20000" placeholder="Unlimited" data-setting="newWordsPerDay" value="${s.newWordsPerDay??''}" aria-label="New vocabulary words per day"></div>
    <div class="settings-row"><div><strong>Target retention</strong><small>FSRS retention target and Auto urgency; score intervals are set above</small></div><select data-setting="desiredRetention">${options([[.85,'85%'],[.9,'90%'],[.95,'95%']],s.desiredRetention)}</select></div>
    <div class="settings-row"><div><strong>Show pinyin on front</strong><small>Word meaning is still hidden</small></div><input class="toggle" type="checkbox" role="switch" data-setting="showPinyinPrompt" ${s.showPinyinPrompt?'checked':''}></div>
    <div class="settings-row"><div><strong>Tone test</strong><small>Choose tone 1–4 below each Chinese character; none = neutral</small></div><input class="toggle" type="checkbox" role="switch" data-setting="toneTest" ${s.toneTest?'checked':''}></div>
    <div class="settings-row"><div><strong>Enforce tone accuracy</strong><small>When tone test is on, a mismatch disables Easy</small></div><input class="toggle" type="checkbox" role="switch" data-setting="enforceTones" ${s.enforceTones?'checked':''}></div></div>
   <div class="section-row"><h2 class="section-title">Chinese typography</h2></div>
   <div class="panel stack font-settings"><p class="subtle">Choose any combination of fonts. Set a master size and each font’s relative size to balance their appearance. Size adjustments affect Chinese learning text only, not the app controls. Each Chinese character occurrence independently receives a random checked font. Nothing changes until you tap <strong>Apply font</strong>.</p>
     ${fontChecklistMarkup(draft)}
     <input type="file" id="ciyan-font-file-input" class="visually-hidden" accept=".ttf,.otf,.woff,.woff2,font/*" aria-label="Choose a Chinese font file" style="position:absolute;left:-10000px;width:1px;height:1px">
     <div class="font-apply-controls"><p id="font-draft-status" class="subtle">${fontSettingChanged(draft,lastAcceptedFont)?'Pending changes — tap Apply to validate and save.':'Current font selection and sizes are applied.'}</p><div class="row"><button type="button" class="btn btn-primary" id="apply-font" data-action="apply-font" ${!fontSettingChanged(draft,lastAcceptedFont)?'disabled':''}>Apply font</button><button type="button" class="btn btn-secondary" id="discard-font" data-action="discard-font" ${!fontSettingChanged(draft,lastAcceptedFont)?'disabled':''}>Discard changes</button></div></div>
     <div class="font-sample"><div class="eyebrow">CURRENT APPLIED FONTS</div><div class="font-sample-chinese" lang="zh-Hans">子子子 春风又绿江南岸，明月何时照我还？</div><p class="subtle">样式测试 · 春天的雨，山中的路，朋友的信。</p></div>
     <p class="subtle">When you apply, each checked custom font is downloaded if necessary, validated, and cached for offline use. If one is unavailable, an error offers to keep the previous fonts or upload the missing file. Font files are separate from learning backups.</p></div>
   <div class="section-row"><h2 class="section-title">Master collection</h2></div><div class="panel stack"><p>All ${MASTER.cards.length} bundled words and ${MASTER.grammar.length} sentences are provided by default. Your imported and edited entries persist across restarts.</p><p class="subtle">New bundled content is merged on the first launch after an app update, without overwriting your own entries. Keep exporting full progress backups regularly; browser storage is not a permanent independent backup.</p></div>
   <div class="section-row"><h2 class="section-title">Your files</h2><span class="subtle">Stored locally on this device</span></div>
   <div class="panel stack"><div class="notice ${backupNeeded()?'warning':''}">${backupNeeded()?'Changes are not confirmed in an exported backup.':'Your current progress is marked as backed up.'}</div>
     <button class="btn btn-primary btn-full file-action-btn" data-action="backup"><span class="file-action-icon">${icon('download')}</span><span class="file-action-label">Export full progress backup</span></button>
     <button class="btn btn-secondary btn-full file-action-btn" data-action="restore"><span class="file-action-icon">${icon('upload')}</span><span class="file-action-label">Restore full backup (preserve master content)</span></button>
     <button class="btn btn-secondary btn-full file-action-btn" data-action="import-deck"><span class="file-action-icon">${icon('plus')}</span><span class="file-action-label">Load complete master file</span></button>
     <button class="btn btn-secondary btn-full file-action-btn" data-action="export-deck"><span class="file-action-icon">${icon('archive')}</span><span class="file-action-label">Export complete master (no review records)</span></button>

     <p class="subtle">Loading a master explicitly replaces your current content; the replacement persists after restarting. Matching words retain their learning records. Full backups contain content and progress; a master export contains only content.</p>
     <p class="subtle">Last confirmed export: ${esc(labelDate(state.lastBackupAt))}</p></div>
   <div class="section-row"><h2 class="section-title">Danger zone</h2></div>
   <div class="panel stack"><p class="lead" style="font-size:13px">Clear review records and progress while retaining every vocabulary and grammar entry. You must type <strong>delete</strong> to confirm.</p>
     <button class="btn btn-danger" data-action="clear-data">${icon('trash')}Clear learning records</button></div>
   <div class="section-row"><h2 class="section-title">About Cíyán</h2></div>
   <div class="panel"><p class="lead" style="font-size:13px">Cíyán v${APP_VERSION} · Offline-first, local-only, independent skill schedules. No accounts, cloud sync, or background uploads.</p>
     <p class="subtle">Browser data may be removed by iOS. Export after each session and keep the JSON in Files or iCloud Drive. Grammar usage risk reflects checked sentence attempts, with sample counts shown in sentence details.</p></div>`;
}
function render(){if(!state)return;const views={study:renderStudy,complete:renderComplete,browse:()=>renderCollection('words'),grammar:()=>renderCollection('grammar'),stats:renderStats,settings:renderSettings};
  app.innerHTML=shell((views[page]||renderStudy)());if(['browse','grammar'].includes(page))updateCollection();applyFontToRoot(app,state.settings);mountDrawing();}
function navigate(dest){if(!['study','browse','grammar','stats','settings','complete'].includes(dest))return;
  if(dest==='settings'&&page!=='settings')pendingFont=cloneFont(lastAcceptedFont);
  if(dest!=='settings')pendingFont=null;
  page=dest;revealed=false;render();window.scrollTo({top:0,behavior:'instant'});}
function modal(title,contents){closeModal();currentModal=document.createElement('div');currentModal.className='modal-backdrop';
  currentModal.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon('x')}</button></div><div class="modal-scroll">${contents}</div></div>`;
  document.body.append(currentModal);applyFontToRoot(currentModal,state.settings);currentModal.querySelector('input:not([type=file]),button')?.focus();}
function closeModal(){if(currentModal){currentModal.remove();currentModal=null;}}
let wordDetailTrail=[];
let wordDetailCurrent=null;
let wordContextLimit=12;
const matchTrace=m=>`<div class="context-match-trace"><strong>${esc(contextMatchLabel(m))}</strong><small>Original tokens: ${esc(m.matchedTokens.map(t=>`{${t}}`).join(''))}</small>${m.rule==='within'?`<small>Matched inside token: ${esc(m.matchedText)}</small>`:m.rule==='whole'?`<small>Whole-token phrase: ${esc(m.matchedText)}</small>`:''}</div>`;
function wordDetails(id,direction='root'){
 const c=wordById(id);if(!c)return;
 if(direction==='root')wordDetailTrail=[];
 else if(direction==='synonym'&&wordDetailCurrent&&wordDetailCurrent!==id)wordDetailTrail.push(wordDetailCurrent);
 if(direction!=='more')wordContextLimit=12;
 wordDetailCurrent=id;
 const schedule=state.schedules[id],history=state.history.filter(h=>h.cardId===id);
  const examples=contextMatches(state,c).map(m=>({...m,qualified:!!scoreGrammar(m.grammar).ready,knowledge:scoreGrammar(m.grammar).combined})).sort(contextSort);
  const knowledge=scoreWord(c);
  // Resolve by stable word ID, never by substring or shared Hanzi characters.
  const byId=new Map(state.cards.map(w=>[w.id,w]));
  const synonyms=(c.synonyms||[]).map(entry=>({entry,card:byId.get(entry.id)})).filter(x=>x.card);
  const back=wordDetailTrail.length?`<button class="btn btn-secondary synonym-back" data-action="synonym-back">${icon('arrow-left')} Back to ${esc(byId.get(wordDetailTrail.at(-1))?.hanzi||'previous word')}</button>`:'';
  modal('Word in context',`${back}<div class="detail-hero"><div class="review-hanzi">${esc(c.hanzi)}</div><div class="review-pinyin">${esc(c.pinyin)}</div><div class="review-english">${esc(c.english)}</div></div>
    <div class="tags-wrap">${c.tags.map(tagHtml).join('')||'<span class="subtle">No tags</span>'}</div>
    <div class="detail-stats"><div><strong>${percent(knowledge)}</strong><span>Knowledge score</span></div>
      <div><strong>${history.length}</strong><span>Times encountered</span></div>
      <div><strong>${schedule?ratingLabels[schedule.lastRating]:'New'}</strong><span>Last rating</span></div>
      <div><strong>${schedule?`${schedule.stability.toFixed(1)}d`:'—'}</strong><span>Stability</span></div></div>
    <div class="panel stack" style="margin:0 0 16px"><div class="row"><span class="subtle">Last encountered</span><strong>${schedule?esc(labelDate(schedule.lastReviewedAt)):'Never'}</strong></div>
      <div class="row"><span class="subtle">Next scheduled</span><strong>${esc(dueLabel(schedule))}</strong></div>
      <div class="row"><span class="subtle">Memory lapses</span><strong>${schedule?.lapses||0}</strong></div></div>
    <div class="panel stack"><div class="row"><span>History score (0–3)</span><strong>${schedule?(schedule.score??schedule.lastRating-1).toFixed(2):'Unseen'}</strong></div><div class="row"><span>Drawing reviews</span><strong>${state.skillSchedules.drawing[id]?.reps||0}</strong></div><div class="row"><span>Drawing score / due</span><strong>${state.skillSchedules.drawing[id]?`${(state.skillSchedules.drawing[id].score??0).toFixed(2)} / ${esc(dueLabel(state.skillSchedules.drawing[id]))}`:'Unseen'}</strong></div></div>
    <div class="section-row"><h3 class="section-title">In context · ${examples.length} sentences</h3></div>
    ${examples.length?examples.slice(0,wordContextLimit).map(m=>{const g=m.grammar;return `<button class="context-card" data-action="grammar-detail" data-id="${esc(g.id)}"><strong>${esc(plainSentence(g.markup))}</strong>
       <small>${esc(g.pinyin)}</small><span>${esc(g.english)}</span>${matchTrace(m)}<div class="row"><span class="subtle">Combined: ${percent(scoreGrammar(g).combined)}</span>${icon('right')}</div></button>`;}).join('')+(examples.length>wordContextLimit?`<button class="btn btn-secondary btn-full" data-action="context-more" data-id="${esc(id)}">Show more examples (${examples.length-wordContextLimit} remaining)</button>`:''):
      '<div class="notice">No grammar sentence matches this word under the complete-token or single-token-substring rules.</div>'}
    <div class="section-row synonym-heading"><h3 class="section-title">Synonyms · ${synonyms.length}</h3><span class="subtle">Similarity · 0–1</span></div>
    ${synonyms.length?`<div class="synonym-list">${synonyms.map(({entry,card})=>`<button class="synonym-card" data-action="synonym-detail" data-id="${esc(card.id)}" aria-label="View synonym ${esc(card.hanzi)}; similarity ${entry.similarity.toFixed(2)}"><span class="synonym-word">${esc(card.hanzi)}<small>${esc(card.pinyin)}</small></span><span class="synonym-score">${entry.similarity.toFixed(2)}</span>${icon('chevron-right')}</button>`).join('')}</div>`:'<p class="subtle">No close synonyms in the current dictionary.</p>'}
    ${drawingDetail(c)}<div class="modal-actions"><button class="btn btn-secondary" data-action="edit-card" data-id="${esc(id)}">${icon('edit')}Edit</button>
      <button class="btn btn-danger" data-action="delete-card" data-id="${esc(id)}">${icon('trash')}Delete</button></div>`);
}
function grammarDetails(id){const g=grammarById(id);if(!g)return;const scores=scoreGrammar(g),tags=grammarTags(g,state.cards);
  const history=state.grammarHistory.filter(h=>h.grammarId===id),correct=history.filter(h=>h.correct).length;
  const involved=[...new Set([...parseSegments(g.markup).filter(x=>x.type==='token').map(x=>x.text),...g.distractors.map(d=>d.word)])];
  const wordScore=word=>state.schedules[state.cards.find(c=>c.hanzi===word)?.id]?.score||0;
  const mean=involved.reduce((n,w)=>n+wordScore(w),0)/Math.max(1,involved.length);
  const weakWords=involved.filter(w=>wordScore(w)<1);
  modal('Grammar in context',`<div class="panel stack"><div class="eyebrow">SENTENCE</div><div class="grammar-detail-hanzi">${esc(plainSentence(g.markup))}</div>
    <div class="review-pinyin">${esc(g.pinyin)}</div><strong>${esc(g.english)}</strong><p class="subtle">Original grammar tiles: ${esc(literalGrammarTokens(g))}</p></div>
    <div class="tags-wrap" style="margin:16px 0">${tags.map(tagHtml).join('')||'<span class="subtle">No inherited tags (add matching word cards)</span>'}</div>
    <div class="detail-stats"><div><strong>${percent(scores.knowledge)}</strong><span>Knowledge</span></div>
      <div><strong>${scores.usageAttempts?percent(scores.usage):"—"}</strong><span>Usage risk · ${scores.usageAttempts} checked</span></div>
      <div><strong>${percent(scores.combined)}</strong><span>Combined</span></div>
      <div><strong>${history.length?`${correct}/${history.length}`:'0'}</strong><span>Grammar correct</span></div></div>
    <div class="panel stack" style="margin-bottom:15px"><strong>${modeCounts(state,'grammar').eligible.some(item=>item.id===id)?'Ready for grammar study':'Not yet unlocked'}</strong>
      <p class="subtle">Each involved word needs score ≥ 1.0, and the sentence's mean must reach 2.0 (current mean ${mean.toFixed(2)}). Words below 1.0:</p>
      <div class="tags-wrap">${weakWords.map(w=>`<span class="tag alt">${esc(w)} · ${wordScore(w).toFixed(2)}</span>`).join('')||'<span class="subtle">None below 1.0</span>'}</div>
      <div class="subtle">Distractors (1-based answer token): ${esc(g.distractors.map(d=>`${d.index}: [${d.word}]`).join(', ')||'none')}</div></div>
    <div class="modal-actions"><button class="btn btn-secondary" data-action="edit-grammar" data-id="${esc(id)}">${icon('edit')}Edit</button>
     <button class="btn btn-danger" data-action="delete-grammar" data-id="${esc(id)}">${icon('trash')}Delete</button></div>`);
}
function wordEditor(id=null){const c=id?wordById(id):{hanzi:'',pinyin:'',english:'',tags:[]};if(!c)return;
  modal(id?'Edit word':'Add a word',`<form id="word-form" data-id="${id?esc(id):''}">
     <div class="form-grid"><div class="form-field"><label for="hanzi">Chinese characters *</label><input id="hanzi" name="hanzi" required maxlength="120" value="${esc(c.hanzi)}"></div>
       <div class="form-field"><label for="pinyin">Pinyin</label><input id="pinyin" name="pinyin" maxlength="160" value="${esc(c.pinyin)}"></div></div>
     <div class="form-field"><label for="english">English *</label><input id="english" name="english" required maxlength="500" value="${esc(c.english)}"></div>
     <div class="form-field"><label for="tags">Tags</label><input id="tags" name="tags" value="${esc(c.tags.join(', '))}" placeholder="Food/ordering, Conversation/social"><span class="help">Comma-separated paths, e.g. HSK/HSK2. Grammar tags are inherited from linked words.</span></div>
     <div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
       <button type="submit" class="btn btn-primary">${icon('check')}${id?'Save edit':'Create word'}</button></div></form>`);
}
function grammarEditor(id=null){const g=id?grammarById(id):{markup:'',pinyin:'',english:'',distractors:[]};if(!g)return;
  modal(id?'Edit grammar':'Add a grammar card',`<form id="grammar-form" data-id="${id?esc(id):''}">
    <div class="form-field"><label for="markup">Chinese sentence with draggable {word} tokens *</label><textarea id="markup" name="markup" required maxlength="900" placeholder="{吃}{什么}？{我}{都}{随便}。">${esc(g.markup)}</textarea>
      <span class="help">Each {...} becomes a moveable tile; punctuation outside braces stays in place. Number word tokens from 1.</span></div>
    <div class="form-field"><label for="pinyin">Pinyin</label><textarea id="pinyin" name="pinyin" maxlength="900">${esc(g.pinyin)}</textarea></div>
    <div class="form-field"><label for="english">English meaning *</label><textarea id="english" name="english" required maxlength="900">${esc(g.english)}</textarea></div>
    <div class="form-field"><label for="distractors">Confusing alternatives (one per line)</label>
      <textarea id="distractors" name="distractors" placeholder="4: [多]">${esc(g.distractors.map(d=>`${d.index}: [${d.word}]`).join('\n'))}</textarea>
      <span class="help">Example: 4: [多] offers 多 as a confusing alternative for word position 4 (one-based). Add the distractor as a vocabulary card, too.</span></div>
    <div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn btn-primary">${icon('check')}${id?'Save edit':'Create grammar'}</button></div></form>`);
}
async function saveWordEditor(form){const id=form.dataset.id||null,existing=id?wordById(id):null;
  let candidate;try{candidate=normalizeCard({...existing,...Object.fromEntries(new FormData(form)),id:id||undefined,source:existing?.source||'My words'});}catch(e){toast(e.message);return;}
  if(state.cards.some(c=>c.id!==id&&c.hanzi===candidate.hanzi)){toast('A word with this exact Chinese text already exists. Edit that word instead.');return;}
  if(existing&&existing.hanzi!==candidate.hanzi)delete candidate.synonyms;
  if(existing?.hanzi!==candidate.hanzi&&state.schedules[id]&&
    !window.confirm('You changed the Chinese word of a studied card. Keep its existing memory history for the new spelling?'))return;
  const done=await change(d=>{if(id){const i=d.cards.findIndex(c=>c.id===id);if(i<0)throw new Error('Word no longer exists');d.cards[i]=candidate;}
    else d.cards.push(candidate);ensureStudy(d);},true,true);
  if(done){invalidateTagOdds();closeModal();toast(id?'Word edited':'Word added');}
}
async function saveGrammarEditor(form){const id=form.dataset.id||null,existing=id?grammarById(id):null;
  let candidate;try{candidate=normalizeGrammar({...existing,...Object.fromEntries(new FormData(form)),id:id||undefined,source:existing?.source||'My grammar'});}catch(e){toast(e.message);return;}
  if(state.grammar.some(g=>g.id!==id&&g.markup===candidate.markup)){toast('That sentence is already in your grammar collection.');return;}
  if(existing?.markup!==candidate.markup&&state.grammarHistory.some(h=>h.grammarId===id)&&
      !window.confirm('Changing this studied sentence will keep its prior attempt history. Continue?'))return;
  const done=await change(d=>{if(id){const i=d.grammar.findIndex(g=>g.id===id);if(i<0)throw new Error('Grammar card no longer exists');d.grammar[i]=candidate;}
    else d.grammar.push(candidate);},true,true);
  if(done){closeModal();toast(id?'Grammar edited':'Grammar card created');}
}
async function deleteWord(id){const c=wordById(id);if(!c)return;
  const uses=contextMatches(state,c).length;
  if(!window.confirm(`Delete “${c.hanzi}” and all of its vocabulary reviews? ${uses} linked grammar sentences will remain but may be locked until a replacement word is added. This is irreversible without a backup.`))return;
  if(await change(d=>{d.lastPracticeUndo=null;if(d.activePractice)d.activePractice.undo=[];d.cards=d.cards.filter(c=>c.id!==id);delete d.schedules[id];delete d.skillSchedules.drawing[id];d.skillHistory=d.skillHistory.filter(h=>!(h.mode==='drawing'&&h.id===id));if(d.activePractice?.current?.id===id)d.activePractice=null;d.history=d.history.filter(h=>h.cardId!==id);
    d.activeSession?.queue&&(d.activeSession.queue=d.activeSession.queue.filter(x=>x!==id));
    if(d.activeSession&&!d.activeSession.queue.length)d.activeSession=null;},true,true)){invalidateTagOdds();closeModal();toast('Word deleted');}
}
async function deleteGrammar(id){const g=grammarById(id);if(!g)return;
  if(!window.confirm(`Delete grammar sentence “${plainSentence(g.markup)}” and its ${state.grammarHistory.filter(h=>h.grammarId===id).length} attempts? This cannot be undone without a backup.`))return;
  if(await change(d=>{d.lastPracticeUndo=null;if(d.activePractice)d.activePractice.undo=[];d.grammar=d.grammar.filter(g=>g.id!==id);delete d.skillSchedules.grammar[id];for(const key of Object.keys(d.skillSchedules.particles))if(key.startsWith(id+':particle:'))delete d.skillSchedules.particles[key];d.skillHistory=d.skillHistory.filter(h=>!h.id.startsWith(id+':particle:'));if(d.activePractice?.current?.id===id||d.activePractice?.current?.id.startsWith(id+':particle:'))d.activePractice=null;d.grammarHistory=d.grammarHistory.filter(h=>h.grammarId!==id);
    d.activeGrammarSession?.queue&&(d.activeGrammarSession.queue=d.activeGrammarSession.queue.filter(x=>x!==id));
    if(d.activeGrammarSession&&!d.activeGrammarSession.queue.length)d.activeGrammarSession=null;},true,true)){closeModal();toast('Grammar sentence deleted');}
}
function clearDataModal(){modal('Clear learning records?',`<div class="notice error"><strong>This removes all review history, schedules, grades, streaks, grammar attempts, and active sessions.</strong> It keeps your vocabulary and grammar cards, as well as your settings. Export a backup first if you want to preserve your progress.</div>
  <div class="form-field" style="margin-top:18px"><label for="clear-confirm">Type <strong>delete</strong> to confirm</label>
  <input id="clear-confirm" placeholder="delete" autocomplete="off" spellcheck="false"></div>
  <div class="modal-actions"><button class="btn btn-secondary" data-action="close-modal">Cancel</button>
    <button class="btn btn-danger" id="clear-confirm-button" data-action="confirm-clear" disabled>Clear records</button></div>`);}
async function clearData(){if(!deleteConfirmationValid($('#clear-confirm')?.value))return;
  const done=await change(d=>clearLearningRecords(d),false);
  if(done){closeModal();lastFinished=null;grammarFeedback=null;revealed=false;page='study';render();toast('Learning records cleared; cards retained. Export your new backup.');}
}
function backupModal(){pendingBackupRevision=null;
  modal('Protect your progress',`<p class="lead" style="font-size:14px;margin-bottom:14px">This backup contains every word, grammar card, learning record, and setting. Save the JSON to your iPhone Files app or iCloud Drive.</p>
    <div class="notice warning" style="margin-bottom:13px">The app cannot verify you saved the file. Only confirm after you can find it in Files.</div>
    <div class="stack"><button class="btn btn-primary btn-full" data-action="share-backup">${icon('upload')}Save to Files (share sheet)</button>
      <button class="btn btn-secondary btn-full" data-action="download-backup">${icon('download')}Download JSON instead</button>
      <div id="backup-confirm-area"></div><p class="subtle">After sharing, choose Save to Files. If you use Download, find the JSON under Files → Downloads.</p></div>`);
}
function downloadFile(file,name){const url=URL.createObjectURL(file),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.style.display='none';
  document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function backupFile(){const {json:content}=prepareVerifiedBackup(state);
  return new File([content],`ciyan-progress-v${APP_VERSION}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,{type:'application/json'});}
async function exportBackup(mode){
  try{
    const file=backupFile(),revision=state.revision;
    if(mode==='share'&&navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Cíyán complete backup'});
    else{downloadFile(file,file.name);if(mode==='share')toast('Share is unavailable; a JSON download was started');}
    pendingBackupRevision=revision;
    const area=$('#backup-confirm-area');if(area)area.innerHTML=`<div class="notice" style="margin-top:8px">File prepared: <strong>${esc(file.name)}</strong></div>
      <button class="btn btn-soft btn-full" style="margin-top:10px" data-action="confirm-backup">${icon('check')}I saved this file in Files</button>`;
  }catch(e){if(e.name!=='AbortError')toast(`Backup failed: ${e.message}`);}
}
async function confirmBackup(){if(pendingBackupRevision===null||saving)return;
  const candidate=cloneProgressState(state);candidate.backedUpRevision=Math.max(candidate.backedUpRevision,Math.min(candidate.revision,pendingBackupRevision));candidate.lastBackupAt=new Date().toISOString();
  try{await saveState(candidate,state.revision);state=candidate;pendingBackupRevision=null;closeModal();render();toast('Export confirmed. Keep that JSON file safe.');}
  catch(e){toast(`Could not save backup status: ${e.message}`);}
}
async function readJsonFile(file){if(!file)return null;if(file.size>40*1024*1024)throw new Error('JSON file exceeds 40 MB');
  try{return JSON.parse(await file.text());}catch{throw new Error('The file is not valid JSON');}}
function requestFile(kind){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.className='fileinput';document.body.append(input);
  input.addEventListener('change',async()=>{try{const content=await readJsonFile(input.files?.[0]);if(content){if(kind==='restore')await restoreBackup(content);else await importDeck(content);}}
    catch(error){toast(error.message);}finally{input.remove();}},{once:true});input.click();}

async function restoreBackup(content){if(saving)return;const parsed=parseBackup(content);
  if(!window.confirm(`Restore learning records and settings from this backup? Existing and current master vocabulary/grammar entries will be retained; current learning history will be replaced. It contains ${parsed.cards.length} words, ${parsed.grammar.length} sentences, ${parsed.history.length} word reviews. Export your current progress first if needed.`))return;
  try{ensureStudy(parsed);mergeRestoredContent(parsed,state,MASTER);parsed.bundledMasterVersion=APP_VERSION;const fontChoice=normalizeFontSettings(parsed.settings);const restoredFontCheck=await verifyFontSelection(fontChoice);if(!restoredFontCheck.ok)Object.assign(parsed.settings,cloneFont(lastAcceptedFont));else Object.assign(parsed.settings,fontChoice);delete parsed.settings.fontDifficulty;delete parsed.settings.fontChoice;parsed.revision=state.revision+1;parsed.backedUpRevision=Math.min(Number(parsed.backedUpRevision)||0,parsed.revision-1);parsed.lastBackupAt=null;await saveState(parsed,state.revision);state=parsed;invalidateTagOdds();page='study';revealed=false;grammarFeedback=null;lastFinished=null;closeModal();render();if(!restoredFontCheck.ok)fontUnavailableDialog(fontChoice,restoredFontCheck);else lastAcceptedFont=cloneFont(fontChoice);pendingFont=cloneFont(lastAcceptedFont);toast('Full backup restored.');}
  catch(e){toast(`Restore failed: ${e.message}`);}
}
async function importDeck(content){
 const draft=replaceMaster(structuredClone(state),content);
 if(!window.confirm(`Load this complete master: ${draft.cards.length} words and ${draft.grammar.length} sentences? It replaces this visit's content. Learning records remain. The imported master persists after restarting the app.`))return;
 if(await change(d=>{d.cards=draft.cards;d.grammar=draft.grammar;d.bundledMasterVersion=APP_VERSION;d.activePractice=null;d.lastPracticeUndo=null;d.activeSession=null;d.activeGrammarSession=null;ensureStudy(d);},true,true)){invalidateTagOdds();closeModal();toast('Master collection saved locally.');}
}
function exportDeck(){const data=makeDeck(state);data.title='Cíyán master collection';
 downloadFile(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`ciyan-master-v${APP_VERSION}.json`);toast('Complete master file prepared');}
function downloadTemplate(){const sample={format:'ciyan-deck',version:2,records:false,
  cards:[{id:'deck-coffee',hanzi:'咖啡',pinyin:'kāfēi',english:'Coffee',tags:['food']}],
  grammar:[{id:'deck-sentence-001',markup:'{我}{想}{喝}{咖啡}。',pinyin:'Wǒ xiǎng hē kāfēi.',english:'I want to drink coffee.',distractors:[{index:2,word:'要'}]}]};
  downloadFile(new Blob([JSON.stringify(sample,null,2)],{type:'application/json'}),'ciyan-deck-template-v0.3.json');}
function finishPrompt(){modal('Finish this session?',`<p class="lead" style="font-size:14px;margin-bottom:20px">Answered cards are already stored locally. Finish and back up your progress, or keep studying.</p>
  <div class="stack"><button class="btn btn-primary btn-full" data-action="end-session">Finish and see summary</button>
    <button class="btn btn-secondary btn-full" data-action="close-modal">Continue studying</button></div>`);}
async function pickGrammarTile(id,slot=null){
  if(saving||grammarFeedback||!state.activeGrammarSession)return;
  const s=state.activeGrammarSession,g=grammarById(s.queue[0]);if(!g)return;
  const tokens=parseSegments(g.markup).filter(x=>x.type==='token'),all=[...tokens.map(t=>`t${t.index}`),...g.distractors.map((_,i)=>`d${i}`)];
  if(!all.includes(id))return;
  const old=s.picks||[];const from=old.indexOf(id);
  const target=slot===null?Array.from({length:tokens.length},(_,i)=>i).find(i=>!old[i]):Number(slot);
  if(target===undefined||!Number.isInteger(target)||target<0||target>=tokens.length)return;
  const done=await change(d=>{const picks=Array.from({length:tokens.length},(_,i)=>d.activeGrammarSession.picks?.[i]||null);
    const prev=picks[target];const fromIndex=picks.indexOf(id);
    if(fromIndex>=0)picks[fromIndex]=prev||null;
    picks[target]=id;d.activeGrammarSession.picks=picks;},false);
  if(done)render();
}
async function removeGrammarTile(slot){if(!state.activeGrammarSession||grammarFeedback)return;
  const done=await change(d=>{if(d.activeGrammarSession.picks)d.activeGrammarSession.picks[slot]=null;},false);
  if(done)render();
}
async function checkGrammar(){if(saving||!state.activeGrammarSession||grammarFeedback)return;
  const s=state.activeGrammarSession,g=grammarById(s.queue[0]);if(!g)return;
  const count=parseSegments(g.markup).filter(x=>x.type==='token').length,picks=s.picks||[];
  if(picks.filter(Boolean).length!==count){toast('Place all words before checking.');return;}
  const mistakes=grammarMistakes(g,picks);
  const correct=mistakes.length===0,completed=s.queue.length<=1,now=new Date().toISOString();
  const done=await change(d=>{const active=d.activeGrammarSession;
    const entry={id:crypto.randomUUID(),grammarId:g.id,at:now,correct,mistakes,selectedTiles:[...picks]};
    d.grammarHistory.push(entry);active.results.push({grammarId:g.id,correct});if(correct)active.correct++;
    active.queue.shift();active.picks=[];
    if(completed){lastFinished={mode:'grammar',id:active.id,startedAt:active.startedAt,endedAt:now,total:active.results.length,
      correct:active.correct,results:active.results};d.grammarSessions.push(lastFinished);d.activeGrammarSession=null;}
  },false);
  if(done){grammarFeedback={grammar:g,correct,picks:[...picks],mistakes};render();}
}
let dragTile=null;
let touchTile=null, suppressTileClick=false;
document.addEventListener('dragstart',event=>{
  const tile=event.target.closest('[data-tile],[data-drop-slot]');if(!tile)return;
  dragTile=tile.dataset.tile||state.activeGrammarSession?.picks?.[Number(tile.dataset.dropSlot)]||null;
  if(!dragTile)return;
  if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',dragTile);}
});
document.addEventListener('dragover',event=>{if(event.target.closest('[data-drop-slot]')&&dragTile)event.preventDefault();});
document.addEventListener('drop',async event=>{const slot=event.target.closest('[data-drop-slot]');if(!slot||!dragTile)return;
  event.preventDefault();const dragged=dragTile;dragTile=null;await pickGrammarTile(dragged,Number(slot.dataset.dropSlot));});
document.addEventListener('dragend',()=>{dragTile=null;});

// Touch dragging on iPhone (HTML5 draggable alone is unreliable in iOS Safari).
// Tapping a bank word remains a first-class alternative to dragging.
document.addEventListener('touchstart',event=>{
  const target=event.target.closest('[data-tile],[data-drop-slot]');
  if(!target||!state?.activeGrammarSession||grammarFeedback)return;
  const tile=target.dataset.tile||state.activeGrammarSession.picks?.[Number(target.dataset.dropSlot)];
  if(!tile)return;
  const touch=event.touches[0];touchTile={id:tile,x:touch.clientX,y:touch.clientY,moved:false};
},{passive:true});
document.addEventListener('touchmove',event=>{
  if(!touchTile)return;
  const point=event.touches[0];
  if(Math.hypot(point.clientX-touchTile.x,point.clientY-touchTile.y)>16)touchTile.moved=true;
  if(touchTile.moved){event.preventDefault();
    document.querySelectorAll('.sentence-slot.hover-target').forEach(e=>e.classList.remove('hover-target'));
    document.elementFromPoint(point.clientX,point.clientY)?.closest('[data-drop-slot]')?.classList.add('hover-target');}
},{passive:false});
document.addEventListener('touchend',async event=>{
  if(!touchTile)return;
  const point=event.changedTouches[0],tile=touchTile;touchTile=null;
  document.querySelectorAll('.sentence-slot.hover-target').forEach(e=>e.classList.remove('hover-target'));
  if(!tile.moved)return;
  suppressTileClick=true;setTimeout(()=>{suppressTileClick=false;},500);
  const slot=document.elementFromPoint(point.clientX,point.clientY)?.closest('[data-drop-slot]');
  if(slot){event.preventDefault();await pickGrammarTile(tile.id,Number(slot.dataset.dropSlot));}
},{passive:false});

// Delegated handlers survive every mobile-first screen re-render.
document.addEventListener('change',event=>{if(event.target.id==='due-window'){dueWindow=event.target.value;render();}else if(event.target.id==='due-resolution'){dueResolution=event.target.value;render();}});
document.addEventListener('click',async event=>{
  if(currentModal&&event.target===currentModal){closeModal();return;}
  if(event.target.closest('.tone-option'))return; // selecting a tone must never reveal the answer
  if(suppressTileClick&&event.target.closest('[data-tile],[data-drop-slot]')){event.preventDefault();return;}
  const element=event.target.closest('[data-action]');if(!element)return;
  const action=element.dataset.action;
  if(await practiceAction(action,element))return;
  switch(action){
    case 'navigate':closeModal();navigate(element.dataset.page);break;
    case 'apply-font':await applyPendingFont();break;
    case 'discard-font':discardPendingFont();break;
    case 'due-bucket':{const n=Number(element.dataset.index);const buttons=[...document.querySelectorAll('.due-column')];const b=buttons[n];if(b)toast(b.getAttribute('aria-label'));break;}
    case 'start':await startSession(element.dataset.mode||'words');break;
    case 'reveal':revealed=true;render();break;
    case 'grade':await gradeCard(Number(element.dataset.grade));break;
    case 'finish-prompt':finishPrompt();break;
    case 'end-session':closeModal();await finishEarly();break;
    case 'open-tag':filters.words.tags={[element.dataset.tag]:1};filters.words.search='';navigate('browse');break;
    case 'expand-tag':{const set=expandedTags[element.dataset.kind],tag=element.dataset.tag;if(set.has(tag))set.delete(tag);else set.add(tag);updateCollection(true);break;}
    case 'cycle-tag':{const f=filters[element.dataset.kind],tag=element.dataset.tag,current=f.tags[tag]||0;
      if(current===0)f.tags[tag]=1;else if(current===1)f.tags[tag]=-1;else delete f.tags[tag];updateCollection();break;}
    case 'reset-tags':filters[element.dataset.kind].tags={};updateCollection();break;
    case 'card-detail':wordDetails(element.dataset.id);break;
    case 'synonym-detail':wordDetails(element.dataset.id,'synonym');break;
    case 'context-more':wordContextLimit+=20;wordDetails(element.dataset.id,'more');break;
    case 'synonym-back':{const previous=wordDetailTrail.pop();if(previous)wordDetails(previous,'back');break;}
    case 'grammar-detail':grammarDetails(element.dataset.id);break;
    case 'new-entry':element.dataset.kind==='grammar'?grammarEditor():wordEditor();break;
    case 'edit-card':wordEditor(element.dataset.id);break;
    case 'edit-grammar':grammarEditor(element.dataset.id);break;
    case 'delete-card':await deleteWord(element.dataset.id);break;
    case 'delete-grammar':await deleteGrammar(element.dataset.id);break;
    case 'backup':backupModal();break;
    case 'close-modal':closeModal();break;
    case 'share-backup':await exportBackup('share');break;
    case 'download-backup':await exportBackup('download');break;
    case 'confirm-backup':await confirmBackup();break;
    case 'restore':requestFile('restore');break;
    case 'import-font-file':case 'upload-missing-font':{uploadingFontSlot=element.dataset.fontId;let input=$('#ciyan-font-file-input');if(!input){input=document.createElement('input');input.type='file';input.id='ciyan-font-file-input';input.accept='.ttf,.otf,.woff,.woff2,font/*';input.style.cssText='position:absolute;left:-10000px;width:1px;height:1px';document.body.append(input);}input.value='';input.click();break;}
    case 'remove-font-file':{const id=element.dataset.fontId;try{if(requiredFonts(lastAcceptedFont).includes(id)){
      const fallback={enabledFonts:FONT_IDS.filter(x=>lastAcceptedFont.enabledFonts.includes(x)&&x!==id)};
      const ok=await change(d=>Object.assign(d.settings,fallback));if(!ok)break;
      lastAcceptedFont=cloneFont(fallback);pendingFont=cloneFont(fallback);
    }await removeFontFile(id);render();toast('Font file removed from this device.');}catch(err){modal('Font removal failed',`<p>${esc(err.message)}</p>`);}break;}

    case 'collection-page':{
      const kind=element.dataset.kind,dir=element.dataset.dir;
      if(kind!=='words'&&kind!=='grammar')break;
      const count=collectionResults(kind,filters[kind],filters[kind].search.trim().toLowerCase()).length;
      const last=Math.max(0,Math.ceil(count/COLLECTION_SIZE)-1);
      collectionPages[kind]=dir==='first'?0:dir==='last'?last:dir==='next'?Math.min(last,collectionPages[kind]+1):Math.max(0,collectionPages[kind]-1);
      updateCollectionPage(kind);break;
    }
    case 'study-filtered':await startFilteredSession();break;
    case 'import-deck':requestFile('deck');break;
    case 'export-deck':exportDeck();break;
    case 'template':downloadTemplate();break;
    case 'clear-data':clearDataModal();break;
    case 'confirm-clear':await clearData();break;
    case 'grammar-pick':await pickGrammarTile(element.dataset.tile);break;
    case 'grammar-slot':await removeGrammarTile(Number(element.dataset.slot));break;
    case 'grammar-check':await checkGrammar();break;
    case 'next-grammar':grammarFeedback=null;page=state.activeGrammarSession?'study':'complete';render();break;
  }
});
document.addEventListener('submit',async event=>{
  if(event.target.matches('#tag-weight-form')){event.preventDefault();await saveTagWeights(event.target);}
  else if(event.target.matches('#scheduler-form')){event.preventDefault();await saveScheduler(event.target);}
  else if(event.target.matches('#word-form')){event.preventDefault();await saveWordEditor(event.target);}
  else if(event.target.matches('#grammar-form')){event.preventDefault();await saveGrammarEditor(event.target);}
});
document.addEventListener('input',event=>{
  if(event.target.dataset?.fontMasterScale!==undefined){setPendingFontScale(null,event.target.value);return;}
  if(event.target.dataset?.fontScaleId){setPendingFontScale(event.target.dataset.fontScaleId,event.target.value);return;}
  if(event.target.closest?.('#scheduler-form'))updateTimingPreview(event.target.closest('#scheduler-form'));
  if(event.target.id==='study-search'){studyFilters.search=event.target.value;const caret=event.target.selectionStart;if(!studyComposing){render();const search=$('#study-search');search?.focus?.({preventScroll:true});if(Number.isInteger(caret))search?.setSelectionRange?.(caret,caret);}return;}
  if(event.target.id==='collection-search') {const kind=page==='grammar'?'grammar':'words';filters[kind].search=event.target.value;updateCollection();}
  if(event.target.id==='clear-confirm') {const b=$('#clear-confirm-button');if(b)b.disabled=!deleteConfirmationValid(event.target.value);}
});
document.addEventListener('compositionstart',event=>{if(event.target.id==='study-search')studyComposing=true;});
document.addEventListener('compositionend',event=>{if(event.target.id==='study-search'){studyComposing=false;studyFilters.search=event.target.value;render();const search=$('#study-search');search?.focus?.({preventScroll:true});}});
document.addEventListener('change',async event=>{
  if(event.target.id==='ciyan-font-file-input'){
    const file=event.target.files?.[0],slot=uploadingFontSlot;uploadingFontSlot=null;
    if(!file||!slot)return;
    try{const imported=await importFontFile(slot,file);closeModal();render();toast(`${imported.name} saved. Choose the font and tap Apply.`);}
    catch(e){render();modal('Could not import font file',`<p>${esc(e.message)}</p><p class="subtle">Export a genuine .ttf/.otf/.woff2 font from your font manager to Files. No learning progress was changed.</p>`);}
    return;
  }
  if(event.target.closest?.('#scheduler-form')){updateTimingPreview(event.target.closest('#scheduler-form'));return;}
  if(event.target.dataset.fontId){setPendingFont(event.target.dataset.fontId,!!event.target.checked);return;}
  if(event.target.dataset?.fontMasterScale!==undefined||event.target.dataset?.fontScaleId){return;} // Sliders remain draft-only until Apply.
  if(event.target.dataset.autoMode){await change(d=>{d.settings.autoModes[event.target.dataset.autoMode]=event.target.checked;});return;}
  if(state.activePractice&&event.target.dataset.toneIndex!==undefined){if(state.activePractice.input.revealed)return;await practiceInput(i=>{i.tones??=[];i.tones[Number(event.target.dataset.toneIndex)]=event.target.checked?Number(event.target.dataset.toneValue):0;});render();return;}
  if(event.target.dataset.toneIndex!==undefined){if(revealed)return;
    const i=Number(event.target.dataset.toneIndex),tone=Number(event.target.dataset.toneValue);
    toneSelections[i]=event.target.checked?tone:0;render();return;}
  if(event.target.dataset.filter){const kind=event.target.dataset.kind,key=event.target.dataset.filter;
    filters[kind][key]=key.endsWith('Value')?Number(event.target.value):event.target.value;updateCollection();return;}
  const key=event.target.dataset.setting;if(!key)return;
  let value=event.target.type==='checkbox'?event.target.checked:Number(event.target.value);
  if(key==='newWordsPerDay')value=event.target.value.trim()===''?null:Math.max(0,Math.min(20000,Math.round(Number(event.target.value)||0)));
  if(key==='sessionSize')value=Math.max(1,Math.min(500,Math.round(value)||12));
  if(key==='desiredRetention')value=[.85,.9,.95].includes(value)?value:.9;
  await change(d=>{d.settings[key]=value;});
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&currentModal){closeModal();return;}
  if(['Enter',' '].includes(event.key)&&!revealed&&page==='study'&&event.target.closest('.review-card')&&!state.settings.toneTest){event.preventDefault();revealed=true;render();}
  if(page==='study'&&revealed&&!currentModal&&['1','2','3','4'].includes(event.key)){if(state.activePractice)gradePractice(Number(event.key));else gradeCard(Number(event.key));}
});
async function boot(){try{
  // Load automatically downloaded or user-imported font bytes before verifying saved typography.
  // A missing font library does not interfere with the independent study database.
  try{await initializeFontLibrary();}catch(e){console.warn('Private font library unavailable:',e);}
  const loaded=await loadState();
  // Existing local data must never be discarded because the app version changed.
  // Creating a fresh state is valid only when no saved state exists. The user
  // controls clearing learning records through the explicit Settings action.
  state=loaded?migrateState(loaded):defaultState();
  let changedContent=false;
  if(!loaded){
    replaceMaster(state,MASTER);
    state.bundledMasterVersion=APP_VERSION;
  }else{
    state.revision=Number(loaded.revision)||0;
    // Once per release, merge any newly bundled content; NEVER overwrite or
    // drop locally imported cards, custom sentences, IDs or score records.
    if(state.bundledMasterVersion!==APP_VERSION){
      const merge=reconcileBundledMaster(state,MASTER);
      changedContent=merge.changed;
      state.bundledMasterVersion=APP_VERSION;
    }
  }
  if(!Array.isArray(state.cards)||!Array.isArray(state.grammar)||!Array.isArray(state.history)||!state.schedules)throw new Error('Local data appears invalid. Import a JSON backup to restore it.');
  ensureStudy(state);
  const selected=normalizeTypographySettings(state.settings);
  const previous=Array.isArray(state.settings.enabledFonts)?state.settings.enabledFonts:null;
  const fontSettingsMigrated=!previous||JSON.stringify(previous)!==JSON.stringify(selected.enabledFonts)||'fontDifficulty' in state.settings||'fontChoice' in state.settings||state.settings.fontMasterScale!==selected.fontMasterScale||JSON.stringify(state.settings.fontScales)!==JSON.stringify(selected.fontScales);
  if(fontSettingsMigrated){Object.assign(state.settings,selected);delete state.settings.fontDifficulty;delete state.settings.fontChoice;}
  const validation=await verifyFontSelection(selected);
  let fontError=null;
  if(!validation.ok){fontError={selected,validation};Object.assign(state.settings,{enabledFonts:['print']});}
  lastAcceptedFont=cloneFont(state.settings);pendingFont=cloneFont(lastAcceptedFont);
  if(!loaded||changedContent||state.bundledMasterVersion!==loaded?.bundledMasterVersion||fontError||fontSettingsMigrated){
    state.revision=(Number(state.revision)||0)+1;
    await saveState(state,loaded?Number(loaded.revision)||0:null);
  }
  studyMode=state.activeGrammarSession?'grammar':'words';render();
  if(fontError)fontUnavailableDialog(fontError.selected,fontError.validation);
  if(state.activePractice&&!state.activePractice.current)void settlePractice();
  if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
  if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
}catch(error){app.innerHTML=`<div class="loading-state" style="text-align:center"><div class="brand-mark">!</div>
  <h2>Local storage unavailable</h2><p>${esc(error.message)}</p><p>Use Safari or the installed Home Screen app, not a private tab or file preview. No data was reset.</p>
  <button class="btn btn-secondary" onclick="location.reload()">Try again</button></div>`;}}
boot();

async function startFilteredSession(){
 if(state.activePractice||state.activeSession||state.activeGrammarSession){await startSession();return;}
 const f=filters.words,q=f.search.trim().toLowerCase();
 const ids=state.cards.filter(c=>matchesTags(c.tags,f.tags)&&(f.rating==='any'||compare(state.schedules[c.id]?.lastRating||0,f.op,Number(f.rating)))&&(!q||[c.hanzi,c.pinyin,c.english,...c.tags].join(' ').toLowerCase().includes(q))).map(c=>c.id);
 await startPractice('words',ids);
}
function autoControls(){
 const enabled=Object.keys(MODES).filter(m=>state.settings.autoModes[m]),rows=enabled.map(m=>modeCounts(state,m,studyFilters));
 const due=rows.reduce((n,x)=>n+x.due,0),started=rows.reduce((n,x)=>n+x.started,0),total=rows.reduce((n,x)=>n+selectedCount(x),0),newCards=rows.reduce((n,x)=>n+x.new,0);
 const canStart=!!enabled.length&&(selectedPool==='due'?due>0:selectedPool==='new'?newCards>0:due+newCards>0)&&(selectedPool==='due'||due>0||enabled.some(m=>m!=='words')||newVocabRemaining(state)>0);
 return `<section class="panel stack auto-panel"><div class="eyebrow">MIXED PRACTICE</div><h2>Auto Study</h2><p>Weighted-random modes and overdue cards, using your preferred weights. No fixed session length.</p><div class="auto-modes">${Object.entries(MODES).map(([m,label])=>`<label><input type="checkbox" data-auto-mode="${m}" ${state.settings.autoModes[m]?'checked':''}> ${label}</label>`).join('')}</div><div class="study-counts"><span><strong>${due}</strong><small>Due now</small></span><span><strong>${started}</strong><small>Started · not due</small></span><span><strong>${total}</strong><small>Available to study</small></span></div><p class="subtle">${newCards} new available across enabled modes</p><button class="btn btn-primary btn-full" data-action="practice-start" data-mode="auto" ${canStart?'':'disabled'}>Start Auto Study</button></section>`;
}
async function startPractice(mode,allowedWords=null){
 if(state.activeSession||state.activeGrammarSession){await startSession();return;}
 if(state.activePractice){page='study';render();return;}
 const session={id:crypto.randomUUID(),mode,filters:structuredClone(studyFilters),pool:selectedPool,allowedWords,startedAt:new Date().toISOString(),continuous:true,limit:state.settings.sessionSize,spent:{},results:[],input:{},skipped:[],deferred:{},turn:0,undo:[]};
 session.current=nextExercise(state,session);if(!session.current){const info=sessionAvailability(state,session);toast(info.due?'Those exercises are temporarily deferred.':'No eligible exercises in this mode and pool.');return;}
 session.itemStartedAt=Date.now();
 if(await change(d=>{d.activePractice=session;d.lastPracticeUndo=null;},false)){page='study';render();}
}
function practiceRatings(mode,id,cap=4){const outcomes=previewOutcomes(scheduleFor(state,mode,id),Date.now(),state.settings);return `<div class="review-controls">${['Again','Hard','Good','Easy'].map((l,i)=>`<button class="grade ${l.toLowerCase()}" data-action="practice-grade" data-grade="${i+1}" ${i+1>cap?'disabled':''}><strong>${l}</strong><span>${outcomes[i].interval}</span><small>Score ${outcomes[i].score.toFixed(2)}</small></button>`).join('')}</div><p class="study-captions">Again: incorrect / forgot · Hard: struggled · Good: recalled · Easy: effortless</p>`;}
function characterScoreLabel(ch,map=null){const x=map?map.get(ch):characterEvidence(state).find(x=>x.character===ch);return x?.score!=null?`score ${x.score.toFixed(2)} · ${x.total} ratings`:'not yet scored';}
function drawingDetail(c){const map=new Map(characterEvidence(state).map(x=>[x.character,x])),p=drawingProfile(c,scheduleFor(state,'drawing',c.id),map);return `<section class="panel stack"><h2>Drawing characters</h2><p>Selection weight ×${p.weight.toFixed(2)} among eligible words. Word score and recent character difficulty both contribute.</p>${[...new Set([...c.hanzi])].filter(ch=>/\p{Script=Han}/u.test(ch)).map(ch=>`<div class="row"><strong>${esc(ch)}</strong><span>${characterScoreLabel(ch,map)}${p.weakest.some(x=>x.character===ch)?' · weakest link':''}</span></div>`).join('')}</section>`;}
function practiceRender(){
 const s=state.activePractice,e=s.current,input=s.input||{};
 if(!e)return waitingPractice(s);
 const top=`<div class="review-top"><button class="icon-btn" data-action="practice-finish" aria-label="Finish session">${icon('x')}</button><div class="review-progress"><span style="width:${Math.min(100,100*s.results.length/Math.max(1,state.settings.sessionSize))}%"></span></div><span>${s.results.length} answered · continuous</span></div><div class="eyebrow">${MODES[e.mode]} · ${esc(e.reason)}${s.mode==='auto'?' · AUTO':''}</div>`;
 let body='';
 if(e.mode==='words'){
  const c=wordById(e.id);toneSelections=input.tones||[];revealed=!!input.revealed;
  const tone=wordToneCheck(c),cap=state.settings.enforceTones&&tone?.wrong.length?3:4;
  body=`<div class="review-card vocab-review"><div class="card-kicker">CHINESE → ENGLISH</div>${state.settings.toneTest?renderToneGrid(c):`<div class="review-hanzi">${esc(c.hanzi)}</div>`}${input.revealed||state.settings.showPinyinPrompt&&!state.settings.toneTest?`<div class="review-pinyin">${esc(c.pinyin)}</div>`:''}${input.revealed?`<div class="review-english">${esc(c.english)}</div>${tone?`<p class="subtle">Expected tones: ${tone.expected.join(' · ')}${cap===3?' · Easy unavailable':''}</p>`:''}`:'<p>Recall the meaning, then reveal.</p>'}</div>${input.revealed?practiceRatings(e.mode,e.id,cap):'<button class="btn btn-primary btn-full" data-action="practice-reveal">Reveal answer</button>'}`;
 }
 if(e.mode==='words'&&input.revealed){const examples=contextsForWord(state,wordById(e.id));if(examples.length)body+=`<section class="panel stack vocab-context"><div class="eyebrow">IN CONTEXT · ${examples.filter(x=>x.qualified).length?`${examples.length} qualified example${examples.length===1?'':'s'}`:'best available example'}</div>${examples.map(m=>{const g=m.grammar;return `<div class="vocab-example"><strong>${esc(plainSentence(g.markup))}</strong><p>${esc(g.pinyin)}</p><p>${esc(g.english)}</p>${matchTrace(m)}</div>`;}).join('')}</section>`;}
 if(e.mode==='drawing'){
  const c=wordById(e.id),chars=[...c.hanzi],index=input.pad||0,g=grammarById(e.contextId),charMap=new Map(characterEvidence(state).map(x=>[x.character,x]));
  const sourceMatch=g?contextMatches(state,c).find(m=>m.grammar.id===g.id):null;
  body=`<section class="panel stack drawing-prompt"><h2>${esc(c.pinyin)}</h2><strong>${esc(c.english)}</strong><span class="tag">${chars.length} character${chars.length===1?'':'s'}</span>${g?`<div class="drawing-context"><div class="eyebrow">WORD IN CONTEXT</div><p>${highlightPinyin(g.pinyin,c.pinyin)}</p><p>${esc(g.english)}</p><small>Target: ${esc(c.pinyin)} — ${esc(c.english)}</small>${sourceMatch?matchTrace(sourceMatch):''}</div>`:'<p class="subtle">No loaded example for this word. Word-only writing practice.</p>'}</section>`;
  body+=input.revealed?`<div class="drawing-comparison">${chars.map((ch,i)=>`<div class="draw-pair"><canvas width="240" height="240" data-drawing-preview="${i}" aria-label="Your drawing ${i+1}"></canvas><span class="printed-character">${esc(ch)}</span><small>Character ${i+1} · ${characterScoreLabel(ch,charMap)}</small></div>`).join('')}</div>
   <section class="panel stack drawing-grade-panel"><h2>Grade each character</h2><p class="subtle">Compare your drawing with the printed characters. Select one rating in each row. After the final selection the session continues automatically. The <strong>lowest character rating</strong> schedules the whole word; all individual ratings are retained. Sketches are never saved.</p>
   <div class="drawing-grade-grid" role="group" aria-label="Character drawing grades">${chars.map((ch,i)=>`<div class="drawing-grade-row" role="group" aria-label="Character ${i+1}: ${esc(ch)}"><span class="drawing-grade-character" title="Character ${i+1}">${esc(ch)}</span>${DRAWING_RATINGS.map(v=>`<button class="grade ${v.label.toLowerCase()} drawing-grade-choice ${input.characterRatings?.[i]&&input.characterRatings[i]!==v.key?'unselected':''} ${input.characterRatings?.[i]===v.key?'selected':''}" data-action="draw-feedback" data-index="${i}" data-rating="${v.key}" aria-label="${ch}: ${v.label}" aria-pressed="${input.characterRatings?.[i]===v.key}"><strong>${v.label}</strong></button>`).join('')}</div>`).join('')}</div>
   <p class="subtle" role="status">${chars.filter((_,i)=>input.characterRatings?.[i]).length} of ${chars.length} characters graded</p></section>`:
  `<div class="drawing-nav"><button class="btn btn-secondary" data-action="draw-page" data-pad="${index-1}" ${index===0?'disabled':''} aria-label="Previous character">←</button><strong>Character ${index+1} of ${chars.length}</strong><button class="btn btn-secondary" data-action="draw-page" data-pad="${index+1}" ${index===chars.length-1?'disabled':''} aria-label="Next character">→</button></div><canvas id="drawing-pad" width="600" height="600" aria-label="Draw character ${index+1}"></canvas><div class="drawing-nav"><button class="btn btn-secondary" data-action="draw-undo">Undo stroke</button><button class="btn btn-secondary" data-action="draw-clear">Clear this character</button></div><button class="btn btn-primary btn-full" data-action="practice-reveal">Reveal characters</button>`;
 }
 if(e.mode==='grammar'){
  const g=grammarById(e.id),bank=shuffledBank(g,s),picks=input.picks||[],tokens=parseSegments(g.markup).filter(t=>t.type==='token');
  body=`<section class="panel stack"><h2>${esc(g.english)}</h2><p class="subtle">Tap words in order or drag them to a slot. Tap a selected word to remove it.</p><div class="grammar-sentence">${parseSegments(g.markup).map(seg=>seg.type==='fixed'?`<span>${esc(seg.text)}</span>`:`<button class="sentence-slot ${picks[seg.index]?'filled':''}" data-action="practice-remove" data-index="${seg.index}" data-practice-slot="${seg.index}" data-practice-tile="${esc(picks[seg.index]||'')}" draggable="${!input.revealed&&!!picks[seg.index]}" ${input.revealed?'disabled':''}>${esc(bank.find(t=>t.id===picks[seg.index])?.word||String(seg.index+1))}</button>`).join('')}</div><div class="grammar-bank">${bank.map(t=>`<button class="bank-tile" data-action="practice-pick" data-tile="${esc(t.id)}" data-practice-tile="${esc(t.id)}" draggable="${!input.revealed&&!picks.includes(t.id)}" ${picks.includes(t.id)||input.revealed?'disabled':''}>${esc(t.word)}</button>`).join('')}</div></section>`;
  body+=input.revealed?`<div class="notice ${input.correct?'':'warning'}"><strong>${input.correct?'Correct target order':'Compare with the target'}</strong><p>${esc(plainSentence(g.markup))}</p><p>${esc(g.pinyin)}</p><small>Explicitly accepted orders are checked. Other natural orders may still exist; a mismatch does not prove that your sentence is ungrammatical.</small></div>${practiceRatings(e.mode,e.id,input.correct?4:2)}`:`<button class="btn btn-primary btn-full" data-action="practice-check" ${picks.filter(Boolean).length!==tokens.length?'disabled':''}>Check sentence</button>`;
 }
 if(e.mode==='particles'){
  const p=allParticles(state).find(p=>p.id===e.id);
  body=`<section class="panel stack"><h2>${esc(p.focus)}</h2><p>${esc(p.prompt)}</p><div class="eyebrow">1. CHOOSE THE PARTICLE OR CLASSIFIER</div><div class="grammar-bank">${p.choices.map(c=>`<button class="bank-tile ${input.choice===c?'chosen':''}" data-action="particle-choice" data-choice="${esc(c)}" ${input.revealed?'disabled':''}>${esc(particleLabel(c))}</button>`).join('')}</div><div class="eyebrow">2. TAP ITS GAP (NOT NEEDED FOR NO PARTICLE)</div><div class="particle-line">${Array.from({length:p.base.length+1},(_,i)=>`<button class="gap ${input.slot===i?'chosen':''}" data-action="particle-slot" data-slot="${i}" aria-label="Gap ${i+1}" ${input.revealed?'disabled':''}>${input.slot===i?esc(input.choice||'?'):'＋'}</button>${i<p.base.length?`<span>${esc(p.base[i])}</span>`:''}`).join('')}</div></section>`;
  body+=input.revealed?`<div class="notice ${input.correct?'':'warning'}"><strong>${input.correct?'Correct':'One to revisit'}</strong>${input.errorType?`<p>Error: ${esc({omission:'a required marker was omitted',unnecessary:'no particle was needed',placement:'right marker, wrong position',choice:'different marker needed'}[input.errorType])}</p>`:''}<p>${esc(particleSentence(p,input.correct?{choice:input.choice,slot:input.slot}:undefined))}</p><p>${esc(input.correct&&input.choice===OMIT&&p.accepted[0].choice!==OMIT?p.pinyin.replace(/ de /,' '):p.pinyin)}</p><p>${esc(p.explanation)}</p></div>${practiceRatings(e.mode,e.id,input.correct?4:2)}`:`<button class="btn btn-primary btn-full" data-action="practice-check" ${!input.choice||(input.choice!==OMIT&&!Number.isInteger(input.slot))?'disabled':''}>Check particle and placement</button>`;
 }
 return top+`<div class="study-live-counts">${sessionCounts(s)}</div>`+body+sessionControls(s)+autoDistribution(s)+'<p class="study-captions">Answers save automatically. Export your progress after studying.</p>';
}
let drawingSave=Promise.resolve();
function mountDrawing(){
 const s=state.activePractice;if(page!=='study'||s?.current?.mode!=='drawing')return;
 const input=s.input||{},pads=input.pads||[];
 if(input.revealed){document.querySelectorAll?.('[data-drawing-preview]').forEach(c=>drawPad(c,pads[Number(c.dataset.drawingPreview)]||[]));return;}
 const canvas=$('#drawing-pad');if(!canvas)return;
 const index=input.pad||0,sessionId=s.id,itemId=s.current.id;
 attachPad(canvas,structuredClone(pads[index]||[]),strokes=>{
  const copy=structuredClone(strokes);
  drawingSave=drawingSave.then(async()=>{
   if(state.activePractice?.id!==sessionId||state.activePractice?.current?.id!==itemId)return;
   await change(d=>{d.activePractice.input.pads??=[];d.activePractice.input.pads[index]=copy;},false);
  });
 });
}
async function practiceInput(fn){await drawingSave;return change(d=>fn(d.activePractice.input,d.activePractice),false);}
async function finishPractice(){await drawingSave;const s=state.activePractice;if(!s)return;
 const finished={id:s.id,mode:s.mode,startedAt:s.startedAt,endedAt:new Date().toISOString(),total:s.results.length,correct:s.results.filter(r=>r.grade>=3).length,newWords:s.results.filter(r=>r.reason==='first practice'&&r.mode==='words').length,results:s.results};
 if(await change(d=>{if(finished.total)d.mixedSessions.push(finished);d.lastPracticeUndo=s.undo?.length?structuredClone(s):null;d.activePractice=null;},false)){lastFinished=finished;page=finished.total?'complete':'study';render();}
}
async function gradePractice(grade){
 await drawingSave;const s=state.activePractice;if(!s?.input?.revealed||saving||![1,2,3,4].includes(grade))return;
 const e=s.current,input=s.input;
 if(e.mode==='drawing')return; // Drawing is graded only through character rows.
 if(['grammar','particles'].includes(e.mode)&&!input.correct&&grade>2)return;
 if(e.mode==='words'){toneSelections=input.tones||[];if(grade===4&&state.settings.enforceTones&&wordToneCheck(wordById(e.id))?.wrong.length)return;}
 const done=await change(d=>{
  const a=d.activePractice;rememberAnswer(d,a);
  const tone=e.mode==='words'?wordToneCheck(wordById(e.id)):null;
  recordExercise(d,a,grade,{toneResult:tone?{expected:tone.expected,selected:tone.chosen,correct:tone.wrong.length===0}:null,seconds:(Date.now()-a.itemStartedAt)/1000,choice:input.choice,slot:input.slot,correct:input.correct,mistakes:input.mistakes,selectedTiles:input.picks,errorType:input.errorType,characters:e.mode==='drawing'?[...wordById(e.id).hanzi].flatMap((character,index)=>input.characterRatings?.[index]?[{character,rating:input.characterRatings[index],grade:{forgotten:1,difficult:2,recalled:3,easy:4}[input.characterRatings[index]]}]:[]):undefined});
  a.current=nextExercise(d,a);
  a.itemStartedAt=Date.now();
 },false);
 if(done){revealed=false;await settlePractice();}
}
async function gradeDrawingCharacter(index,rating){
 await drawingSave;
 const current=state.activePractice;
 if(saving||current?.current?.mode!=='drawing'||!current.input?.revealed)return;
 const card=wordById(current.current.id),chars=[...card.hanzi];
 const ratings=withDrawingRating(current.input.characterRatings,index,rating,chars.length);
 if(!ratings)return;
 const completed=drawingResult(card.hanzi,ratings);
 const elapsed=(Date.now()-current.itemStartedAt)/1000;
 const done=await change(d=>{
  const active=d.activePractice;
  active.input.characterRatings=ratings;
  if(!completed)return;
  // One atomic transaction commits all character evidence and the derived
  // minimum word grade, then advances to the next eligible exercise.
  rememberAnswer(d,active);
  recordExercise(d,active,completed.grade,{seconds:elapsed,characters:completed.characters});
  active.current=nextExercise(d,active);
  active.itemStartedAt=Date.now();
 },false);
 if(!done)return;
 if(completed){revealed=false;await settlePractice();}
 else render();
}
async function practiceAction(action,el){
 if(Date.now()<ignorePracticeClickUntil&&['practice-pick','practice-remove'].includes(action))return true;
 if(action==='undo-completed'){await undoCompleted();return true;}
 if(action==='apply-timing'){await applyTiming(el.dataset.scope);return true;}
 if(action==='study-expand-tag'){const tag=el.dataset.tag;if(expandedTags.study.has(tag))expandedTags.study.delete(tag);else expandedTags.study.add(tag);render();return true;}
 if(action==='study-tag'){const tag=el.dataset.tag,v=studyFilters.tags[tag]||0;if(v===-1)delete studyFilters.tags[tag];else studyFilters.tags[tag]=v===0?1:-1;render();return true;}
 if(action==='study-clear-filters'){studyFilters.tags={};studyFilters.search='';render();return true;}
 if(action==='study-pool'){if(POOLS.includes(el.dataset.pool))selectedPool=el.dataset.pool;render();return true;}
 if(action==='practice-start'){await startPractice(el.dataset.mode);return true;}
 if(!state.activePractice)return false;
 if(action==='practice-undo'){await undoPractice();return true;}
 if(action==='practice-skip'){await movePractice('skip');return true;}
 if(action==='practice-postpone'){await movePractice('postpone');return true;}
 if(action==='practice-check-ready'){await wakePractice();return true;}
 if(action==='practice-finish'){await finishPractice();return true;}
 if(action==='practice-grade'||action==='grade'){await gradePractice(Number(el.dataset.grade));return true;}
 const s=state.activePractice,e=s.current;
 if(!e)return false;
 if(['practice-reveal','reveal'].includes(action)){await practiceInput(i=>{i.revealed=true;});render();return true;}
 if(action==='draw-feedback'&&e.mode==='drawing'&&s.input.revealed){await gradeDrawingCharacter(Number(el.dataset.index),el.dataset.rating);return true;}
 if(s.input.revealed)return false;
 if(action==='draw-page'){const n=Number(el.dataset.pad);if(n>=0&&n<[...wordById(e.id).hanzi].length)await practiceInput(i=>{i.pad=n;});}
 else if(action==='draw-undo'||action==='draw-clear')await practiceInput(i=>{i.pads??=[];const n=i.pad||0;i.pads[n]??=[];if(action==='draw-clear')i.pads[n]=[];else i.pads[n].pop();});
 else if(action==='practice-pick')await practiceInput(i=>{i.picks??=[];const count=parseSegments(grammarById(e.id).markup).filter(x=>x.type==='token').length;const n=Array.from({length:count},(_,n)=>n).find(n=>!i.picks[n]);if(n!==undefined&&!i.picks.includes(el.dataset.tile))i.picks[n]=el.dataset.tile;});
 else if(action==='practice-remove')await practiceInput(i=>{if(i.picks)i.picks[Number(el.dataset.index)]=null;});
 else if(action==='particle-choice')await practiceInput(i=>{i.choice=el.dataset.choice;if(i.choice===OMIT)i.slot=-1;else if(i.slot===-1)i.slot=null;});
 else if(action==='particle-slot')await practiceInput(i=>{i.slot=Number(el.dataset.slot);});
 else if(action==='practice-check')await practiceInput(i=>{
  if(e.mode==='grammar'){const g=grammarById(e.id);if((i.picks||[]).filter(Boolean).length!==parseSegments(g.markup).filter(x=>x.type==='token').length)return;i.mistakes=grammarMistakes(g,i.picks);i.correct=i.mistakes.length===0;}
  else{const p=allParticles(state).find(x=>x.id===e.id);if(!p.choices.includes(i.choice)||(i.choice!==OMIT&&!Number.isInteger(i.slot)))return;i.correct=particleCorrect(p,i.choice,i.slot);i.errorType=particleError(p,i.choice,i.slot);}
  i.revealed=true;
 });else return false;
 render();return true;
}
function extendedStats(){
 const counts=reviewDayCounts(),now=Date.now();
 const total=state.history.length+state.grammarHistory.length+state.skillHistory.length;
 const days=Array.from({length:28},(_,i)=>{const d=new Date();d.setDate(d.getDate()-27+i);const key=formatDay(d);return {key,count:counts.get(key)||0};});
 const max=Math.max(1,...days.map(d=>d.count));
 const dueCounts=new Map();for(const e of activeDueEntries()){const key=dateKey(e.dueAt);dueCounts.set(key,(dueCounts.get(key)||0)+1);}
 const forecasts=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);const key=formatDay(d);return {key,n:dueCounts.get(key)||0};});
 const particleCounts=new Map();for(const h of state.skillHistory)if(h.mode==='particles'){
  const x=particleCounts.get(h.id)||{n:0,bad:0};x.n++;if(h.correct===false)x.bad++;particleCounts.set(h.id,x);
 }
 const trouble=allParticles(state).map(p=>({p,...(particleCounts.get(p.id)||{n:0,bad:0})})).filter(x=>x.bad).sort((a,b)=>b.bad-a.bad).slice(0,6);
 return `${feedbackStats()}${dueChart()}<section class="panel stack"><h2>Skill balance</h2><p class="subtle">Success means Good/Easy; recall is the model’s estimate, not a measured test score.</p><div class="stats-table-wrap"><table class="skill-table"><thead><tr><th>Skill</th><th>Seen</th><th>Due</th><th>Attempts</th><th>Success</th><th>Recall</th></tr></thead><tbody>${Object.entries(MODES).map(([m,name])=>{const x=skillSummary(state,m,now);return `<tr><th>${name}</th><td>${x.seen}</td><td>${x.due}</td><td>${x.attempts}</td><td>${x.success===null?'—':percent(x.success)}</td><td>${x.recall===null?'—':percent(x.recall)}</td></tr>`;}).join('')}</tbody></table></div></section>
 <section class="panel stack" style="margin-top:16px"><h2>28-day activity</h2><div class="activity-grid">${days.map(d=>`<div title="${d.key}: ${d.count} reviews" style="background:rgba(45,128,108,${.08+.85*d.count/max})"><small>${d.key.slice(8)}</small><strong>${d.count}</strong></div>`).join('')}</div><p class="subtle">All four modes · ${total} recorded attempts</p></section>
 <section class="panel stack" style="margin-top:16px"><h2>Next seven days</h2><div class="forecast">${forecasts.map(d=>`<div><small>${d.key.slice(5)}</small><strong>${d.n}</strong></div>`).join('')}</div><p class="subtle">Scheduled reviews only, excluding new items and overdue backlog. Dates will change as you study.</p></section>
 <section class="panel stack" style="margin-top:16px"><h2>Particles to revisit</h2>${trouble.length?trouble.map(x=>`<div class="particle-issue"><strong>${esc(x.p.focus)}</strong><span>${x.bad} incorrect · ${x.n} attempts</span></div>`).join(''):'<p class="subtle">Particle choice and placement errors will appear here after practice.</p>'}</section>`;
}

function highlightPinyin(sentence,word){
 const letters=[],positions=[];[...sentence].forEach((ch,i)=>{if(/[\p{L}]/u.test(ch)){letters.push(ch.toLowerCase());positions.push(i);}});
 const target=[...word.toLowerCase()].filter(ch=>/[\p{L}]/u.test(ch)).join('');const at=letters.join('').indexOf(target);
 if(!target||at<0)return esc(sentence);
 const chars=[...sentence],start=positions[at],end=positions[at+target.length-1]+1;
 if(/[\p{L}]/u.test(chars[start-1]||'')||/[\p{L}]/u.test(chars[end]||''))return esc(sentence);
 return esc(chars.slice(0,start).join(''))+'<mark>'+esc(chars.slice(start,end).join(''))+'</mark>'+esc(chars.slice(end).join(''));
}

async function dropPracticeTile(tile,slot){
 const s=state.activePractice;if(s?.current?.mode!=='grammar'||s.input.revealed)return;
 const g=grammarById(s.current.id),bank=shuffledBank(g,s),count=parseSegments(g.markup).filter(x=>x.type==='token').length;
 if(!bank.some(t=>t.id===tile)||slot<0||slot>=count)return;
 await practiceInput(i=>{i.picks??=[];const old=i.picks.indexOf(tile),displaced=i.picks[slot];if(old>=0)i.picks[old]=displaced||null;i.picks[slot]=tile;});render();
}
// Event listeners are combined with the existing delegated handlers below in tests.
let practiceDrag=null,practiceTouch=null,ignorePracticeClickUntil=0;
document.addEventListener('dragstart',event=>{const el=event.target.closest('[data-practice-tile]');if(el?.dataset.practiceTile){practiceDrag=el.dataset.practiceTile;event.dataTransfer?.setData('text/plain',practiceDrag);}});
document.addEventListener('dragover',event=>{if(practiceDrag&&event.target.closest('[data-practice-slot]'))event.preventDefault();});
document.addEventListener('drop',async event=>{const el=event.target.closest('[data-practice-slot]');if(el&&practiceDrag){event.preventDefault();const tile=practiceDrag;practiceDrag=null;await dropPracticeTile(tile,Number(el.dataset.practiceSlot));}});
document.addEventListener('dragend',()=>{practiceDrag=null;});
document.addEventListener('touchstart',event=>{const el=event.target.closest('[data-practice-tile]');if(el?.dataset.practiceTile&&!state.activePractice?.input.revealed){const t=event.touches[0];practiceTouch={tile:el.dataset.practiceTile,x:t.clientX,y:t.clientY,moved:false};}},{passive:true});
document.addEventListener('touchmove',event=>{if(!practiceTouch)return;const t=event.touches[0];if(Math.hypot(t.clientX-practiceTouch.x,t.clientY-practiceTouch.y)>16)practiceTouch.moved=true;if(practiceTouch.moved)event.preventDefault();},{passive:false});
document.addEventListener('touchend',async event=>{const touch=practiceTouch;practiceTouch=null;if(!touch?.moved)return;ignorePracticeClickUntil=Date.now()+500;const t=event.changedTouches[0],el=document.elementFromPoint(t.clientX,t.clientY)?.closest('[data-practice-slot]');if(el){event.preventDefault();await dropPracticeTile(touch.tile,Number(el.dataset.practiceSlot));}},{passive:false});

function tagWeightSettings(){
 const odds=appliedNewWordOdds();const weights=state.settings.tagWeights||{};
 const grouped=new Map();for(const tag of odds.leaves){const root=tag.split('/')[0];if(!grouped.has(root))grouped.set(root,[]);grouped.get(root).push(tag);}
 return `<section class="panel stack tag-weight-settings"><div class="row"><h2>New vocabulary · tag weights</h2></div><p class="subtle">Each unstudied word has weight max(1, 1 + the sum of its leaf-tag weights). Weights may be negative or decimal; zero is neutral. Tags on the same word share that word's selection chance, so their inclusive odds can add to more than 100%. Untagged words have weight 1.</p><p class="subtle">${odds.newCount} unstudied words · ${odds.totalWeight.toFixed(1)} total weighted tickets · ${odds.untagged} untagged. Odds reflect the currently <strong>applied</strong> weights, not pending edits.</p><form id="tag-weight-form"><div class="tag-weight-groups">${[...grouped].map(([root,tags])=>`<details class="tag-weight-group"><summary>${esc(tagLabel(root))} <small>${tags.length} tags</small></summary><div class="tag-weight-table"><div class="tag-weight-head"><span>Leaf tag</span><span>Weight</span><span>New-card odds</span></div>${tags.map(t=>`<div class="tag-weight-row"><label for="weight-${esc(t)}">${esc(tagLabel(t.split('/').at(-1)))} <small>${odds.counts[t]} new</small></label><input id="weight-${esc(t)}" data-tag-weight="${esc(t)}" type="number" step="any" value="${esc(weights[t]??0)}" required aria-label="Weight for ${esc(tagLabel(t))}"><output>${odds.odds[t].toFixed(2)}%</output></div>`).join('')}</div></details>`).join('')}</div><button type="submit" class="btn btn-primary btn-full">Apply tag weights &amp; recalculate odds</button></form><p class="subtle">New tags start at weight 0. These preferences are stored in settings and the full progress backup, not the master collection. Due reviews ignore introduction weights.</p></section>`;
}
async function saveTagWeights(form){try{
 const weights={...state.settings.tagWeights};
 const nodes=[...form.querySelectorAll('[data-tag-weight]')];
 for(const input of nodes){const value=Number(input.value);if(input.value.trim()===''||!Number.isFinite(value))throw new Error('Each tag weight must be a finite number.');weights[input.dataset.tagWeight]=value;}
 const clean=validatedTagWeights(weights);
 if(await change(d=>{d.settings.tagWeights=clean;})){invalidateTagOdds();render();toast('New-card weights applied; probabilities recalculated.');}
 }catch(e){toast(e.message);}
}
function schedulerSettings(){const settings=state.settings,config=settings.retryIntervals||DEFAULT_RETRY;
 return `<section class="panel stack"><h2>Review timing</h2><form id="scheduler-form" class="stack"><label>Scheduling method <select name="scheduler">${options([['score','Gradual score + retry intervals'],['fsrs','FSRS memory model']],settings.scheduler)}</select></label><p class="subtle">New scores start at 0. Success increases the score gradually; closely repeated recalls earn less credit. Again reduces the score by 20%, without resetting it. Fractional scores use geometric interpolation.</p>${config.map((c,i)=>`<div class="retry-row"><label for="retry-${i}">${i} · ${ratingLabels[i+1]}</label><input id="retry-${i}" name="value${i}" type="number" min="0.001" step="any" required value="${c.value}" aria-label="${ratingLabels[i+1]} interval"><select name="unit${i}" aria-label="${ratingLabels[i+1]} unit">${options(Object.keys(UNITS).map(u=>[u,u]),c.unit)}</select></div>`).join('')}<div id="timing-preview">${timingCurve(settings)}</div><h3>Auto Study preferred weights</h3>${Object.entries(MODES).map(([m,n])=>`<label class="retry-row">${n}<input name="share-${m}" type="number" min="1" max="100" step="1" value="${Math.round(settings.autoShares[m]*100)}" aria-label="${n} weight"></label>`).join('')}<p class="subtle">Weights are normalized among enabled modes. Actual practice time can differ when reviews or prerequisites take priority.</p><button class="btn btn-primary btn-full" type="submit">Preview scheduling changes</button></form></section>`;
}
async function saveScheduler(form){try{
 pendingTiming=readTimingForm(form);const impact=timingImpact(state,pendingTiming);
 modal('Review scheduling changes',`${timingCurve(pendingTiming)}<p><strong>${impact.additional} additional reviews due now.</strong> ${impact.later} currently due reviews move later. Due now: ${impact.before.due} → ${impact.after.due} if existing schedules are recalculated.</p><div class="stack"><button class="btn btn-primary" data-action="apply-timing" data-scope="future">Use for future reviews only</button><button class="btn btn-secondary" data-action="apply-timing" data-scope="existing">Also recalculate existing schedules</button><button class="btn btn-secondary" data-action="close-modal">Cancel</button></div><p class="subtle">No scores or review history are erased. Applying timing starts a new undo boundary.</p>`);
 }catch(e){toast(e.message);}}
function dueChart(){
 const entries=activeDueEntries(),now=Date.now();
 const windows={all:null,day:86400,week:604800,month:2592000,quarter:7776000,year:31536000};
 const steps={auto:null,hour:3600,day:86400,week:604800,month:2592000};
 const windowSeconds=windows[dueWindow]??null;
 const points=entries.map(e=>({...e,offset:(Date.parse(e.dueAt)-now)/1000})).filter(e=>Number.isFinite(e.offset));
 const selected=windowSeconds===null?points:points.filter(e=>e.offset>=-windowSeconds&&e.offset<=windowSeconds);
 const offsets=selected.map(e=>e.offset);
 const min=offsets.length?Math.min(0,...offsets):0,maxOffset=offsets.length?Math.max(0,...offsets):0;
 const autoStep=(()=>{const span=Math.max(1,maxOffset-min);const target=Math.max(8,Math.min(28,Math.floor((globalThis.innerWidth||390)/24)));const sizes=[3600,21600,86400,259200,604800,1209600,2592000,7776000,31536000];return sizes.find(x=>span/x<=target)||sizes.at(-1);})();
 const step=steps[dueResolution]||autoStep;
 const start=Math.floor(min/step)*step,end=Math.ceil(maxOffset/step)*step;
 const count=Math.max(1,Math.min(360,Math.round((end-start)/step)+1));
 const bins=Array.from({length:count},(_,i)=>({start:start+i*step,end:start+(i+1)*step,total:0,counts:Object.fromEntries(Object.keys(MODES).map(m=>[m,0]))}));
 for(const e of selected){const i=Math.max(0,Math.min(count-1,Math.floor((e.offset-start)/step)));bins[i].total++;if(e.mode in bins[i].counts)bins[i].counts[e.mode]++;}
 const peak=Math.max(1,...bins.map(b=>b.total));
 const when=s=>Math.abs(s)<1?'Now':`${s<0?'−':'+'}${intervalText(Math.abs(s))}`;
 const option=(items,value)=>items.map(([k,v])=>`<option value="${k}" ${k===value?'selected':''}>${v}</option>`).join('');
 return `<section class="panel stack due-panel"><h2>Overdue → next due</h2><p class="subtle">Choose a time window and bucket size. Scroll the plot horizontally for more detail; tap any bar for exact counts.</p>
 <div class="due-controls"><label>Time window<select id="due-window">${option([['all','All scheduled'],['day','±1 day'],['week','±1 week'],['month','±30 days'],['quarter','±90 days'],['year','±1 year']],dueWindow)}</select></label><label>Resolution<select id="due-resolution">${option([['auto','Automatic'],['hour','Hourly'],['day','Daily'],['week','Weekly'],['month','Monthly']],dueResolution)}</select></label></div>
 <div class="due-legend">${Object.entries(MODES).map(([m,n])=>`<span><i class="mode-${m}"></i>${n}</span>`).join('')}</div>
 ${selected.length?`<div class="due-chart" aria-label="Review workload histogram"><div class="due-bars">${bins.map((b,i)=>`<button type="button" class="due-column ${b.end<=0?'overdue':''}" data-action="due-bucket" data-index="${i}" aria-label="${when(b.start)} to ${when(b.end)}: ${b.total} reviews"><strong>${b.total||''}</strong><span class="due-stack">${Object.keys(MODES).map(m=>`<span class="mode-${m}" style="height:${Math.max(0,150*b.counts[m]/peak)}px"></span>`).join('')}</span><small>${when(b.start)}</small></button>`).join('')}</div></div>
 <p class="subtle">${points.filter(e=>e.offset<=0).length} overdue · ${entries.length} scheduled · ${selected.length} in view · ${intervalText(step)} per bar</p><details><summary>View exact bucket counts</summary><div class="stats-table-wrap"><table class="skill-table"><thead><tr><th>Range</th>${Object.values(MODES).map(m=>`<th>${m}</th>`).join('')}</tr></thead><tbody>${bins.filter(b=>b.total).map(b=>`<tr><th>${when(b.start)} to ${when(b.end)}</th>${Object.values(b.counts).map(n=>`<td>${n}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`:'<p class="subtle">No scheduled reviews in this window.</p>'}</section>`;
}
let dueWindow='all',dueResolution='auto';
let resizeTimer;
window.addEventListener?.('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(page==='stats')render();},160);});

function sessionControls(s){return `<div class="session-controls"><button class="btn btn-secondary" data-action="practice-undo" ${s.undo?.length?'':'disabled'}>Undo last answer</button>${s.current?'<button class="btn btn-secondary" data-action="practice-skip">Skip this session</button><button class="btn btn-secondary" data-action="practice-postpone">Postpone · later here</button>':''}<button class="btn btn-secondary" data-action="practice-finish">Finish session</button></div>`;}
function autoDistribution(s){
 if(s.mode!=='auto')return '';
 const sum=Object.values(s.spent).reduce((n,x)=>n+x,0),weights=state.settings.autoShares||SHARES;
 const total=Object.keys(MODES).reduce((n,m)=>n+(state.settings.autoModes[m]?weights[m]:0),0)||1;
 const status=availability(state,s);
 return `<details class="panel auto-distribution"><summary>Auto Study balance · actual vs preferred</summary><p class="subtle">Shares use practice time, not card count. Due/relearning reviews take priority; vocabulary prerequisites can block other modes.</p><table class="skill-table"><tr><th>Mode</th><th>Actual</th><th>Preferred</th><th>Ready now</th></tr>${Object.entries(MODES).map(([m,n])=>`<tr><th>${n}</th><td>${percent(sum?(s.spent[m]||0)/sum:0)}</td><td>${state.settings.autoModes[m]?percent(weights[m]/total):'Off'}</td><td>${status.modes.find(x=>x.mode===m)?.due||0}</td></tr>`).join('')}</table>${status.modes.filter(m=>m.blocked).map(m=>`<p class="subtle">${MODES[m.mode]}: ${m.blocked} excluded by session filters or waiting on vocabulary scores.</p>`).join('')}</details>`;
}
let waitTimer;
function sessionCounts(session){const info=sessionAvailability(state,session);return `<div class="study-counts"><span><strong>${info.due}</strong><small>Due now</small></span><span><strong>${info.started}</strong><small>Started · not due</small></span><span><strong>${info.available}</strong><small>Available to study</small></span></div>`;}
function waitingPractice(s){
 const a=sessionAvailability(state,s),seconds=a.nextAt?Math.max(0,(a.nextAt-Date.now())/1000):null;
 clearTimeout(waitTimer);
 if(seconds!==null){waitTimer=setTimeout(()=>{if(page==='study'&&state.activePractice?.id===s.id&&!state.activePractice.current)wakePractice();},Math.max(1000,Math.min(60000,seconds*1000+30)));waitTimer.unref?.();}
 return `<section class="panel stack"><div class="eyebrow">CONTINUOUS STUDY</div><h2>${seconds!==null?'Postponed item returning soon':'No eligible exercises remain'}</h2><p>${seconds!==null?`Postponed exercises can return in ${intervalText(seconds)}, or after other turns. No grade or due-date change was recorded.`:'All due work is complete, and no new exercises remain under your chosen pool, filters and daily vocabulary limit.'}</p><button class="btn btn-primary" data-action="practice-check-ready">Check again</button></section>${sessionCounts(s)}${sessionControls(s)}${autoDistribution(s)}`;
}
async function settlePractice(){
 if(!state.activePractice)return;
 if(state.activePractice.current){render();return;}
 const sess=state.activePractice,stats=sessionAvailability(state,sess);
 // A temporary in-session postponement is the sole reason to wait after exhaustion.
 const hasDeferred=Object.entries(sess.deferred||{}).some(([key,val])=>!(sess.skipped||[]).includes(key)&&(val?.at>Date.now()||(sess.turn||0)<val?.turn));
 if(hasDeferred&&stats.nextAt!==null){render();return;}
 await finishPractice();
}
async function wakePractice(){
 if(saving||!state.activePractice||state.activePractice.current)return;
 const next=nextExercise(state,state.activePractice);
 if(next)await change(d=>{d.activePractice.current=next;d.activePractice.input={};d.activePractice.itemStartedAt=Date.now();},false);
 await settlePractice();
}
async function movePractice(kind){
 await drawingSave;if(!state.activePractice?.current)return;
 const done=await change(d=>{const s=d.activePractice;if(kind==='skip')skipItem(s);else postponeItem(d,s);s.current=nextExercise(d,s);s.itemStartedAt=Date.now();},false);
 if(done)await settlePractice();
}
async function undoPractice(){
 await drawingSave;if(!state.activePractice?.undo?.length)return;
 if(await change(d=>{undoAnswer(d,d.activePractice);},false)){page='study';render();toast('Last answer undone, including its schedule and history.');}
}
async function undoCompleted(){
 if(!state.lastPracticeUndo)return;
 const done=await change(d=>{d.activePractice=d.lastPracticeUndo;d.lastPracticeUndo=null;d.mixedSessions=d.mixedSessions.filter(s=>s.id!==d.activePractice.id);undoAnswer(d,d.activePractice);},false);
 if(done){lastFinished=null;page='study';render();}
}
function timingCurve(settings){
 const values=retrySeconds(settings.retryIntervals),lo=Math.log(values[0]),span=Math.max(.01,Math.log(values[3])-lo);
 const points=Array.from({length:61},(_,i)=>`${30+i*5},${155-125*(Math.log(interpolatedSeconds(i/20,settings.retryIntervals))-lo)/span}`).join(' ');
 return `<svg class="timing-curve" viewBox="0 0 360 190" role="img" aria-label="Score to retry interval, logarithmic time scale"><path d="M30 20V155H330" fill="none" stroke="#a6b9ad"/><polyline points="${points}" fill="none" stroke="#24765d" stroke-width="3"/>${values.map((n,i)=>`<text x="${30+i*100}" y="177" text-anchor="middle">${i}</text><text x="${Math.max(40,Math.min(312,30+i*100))}" y="${Math.max(15,145-125*(Math.log(n)-lo)/span)}" text-anchor="middle">${intervalText(n)}</text>`).join('')}</svg><p class="subtle">Score → retry interval · logarithmic time scale. Rating buttons use the predicted next score, not these anchor values directly.</p>`;
}
function readTimingForm(form){
 const f=new FormData(form),retryIntervals=Array.from({length:4},(_,i)=>({value:Number(f.get('value'+i)),unit:String(f.get('unit'+i))}));retrySeconds(retryIntervals);
 const autoShares=Object.fromEntries(Object.keys(MODES).map(m=>[m,Number(f.get('share-'+m)??(state.settings.autoShares[m]*100))/100]));
 if(Object.values(autoShares).some(n=>!Number.isFinite(n)||n<=0||n>1))throw new Error('Auto Study weights must be between 1 and 100. Disable a mode with its checkbox.');
 return {...state.settings,retryIntervals,autoShares,scheduler:f.get('scheduler')==='fsrs'?'fsrs':'score'};
}
function updateTimingPreview(form){const node=$('#timing-preview');if(!node)return;try{const settings=readTimingForm(form),impact=timingImpact(state,settings);node.innerHTML=timingCurve(settings)+`<p><strong>${impact.additional} additional reviews due now</strong>; ${impact.later} currently due reviews move later if applied to existing schedules.</p>`;}catch(e){node.textContent=e.message;}}
let pendingTiming=null;
async function applyTiming(scope){if(!pendingTiming||!['future','existing'].includes(scope))return;
 const settings=pendingTiming;
 const done=await change(d=>{d.settings={...d.settings,...settings};if(scope==='existing')for(const map of [d.schedules,...Object.values(d.skillSchedules)])for(const id of Object.keys(map))map[id]=rescheduleExisting(map[id],d.settings);d.lastPracticeUndo=null;if(d.activePractice)d.activePractice.undo=[];},false);
 if(done){pendingTiming=null;closeModal();render();toast(scope==='existing'?'Timing saved and existing schedules recalculated.':'Timing saved for future reviews; existing due dates unchanged.');}
}

function dueLabel(schedule,now=Date.now()){if(!schedule)return 'New';const seconds=(Date.parse(schedule.dueAt)-now)/1000;return seconds<=0?'Due now':'In '+intervalText(seconds);}

let dueEntriesCache=null;
function activeDueEntries(){
 if(dueEntriesCache?.revision===state.revision)return dueEntriesCache.entries;
 const ids={words:state.cards.map(c=>c.id),drawing:state.cards.map(c=>c.id),grammar:state.grammar.map(g=>g.id),particles:allParticles(state).map(p=>p.id)};
 const entries=Object.keys(MODES).flatMap(mode=>ids[mode].flatMap(id=>{
  const sched=scheduleFor(state,mode,id),postponed=state.postponed?.[`${mode}:${id}`];
  if(!sched&&!postponed)return [];
  const at=Math.max(sched?Date.parse(sched.dueAt):0,postponed?Date.parse(postponed):0);
  return [{mode,dueAt:new Date(at).toISOString()}];
 }));
 dueEntriesCache={revision:state.revision,entries};return entries;
}

function feedbackStats(){
 const chars=characterEvidence(state).slice(0,20),families=[...familyEvidence(state)].sort((a,b)=>b[1].errors-a[1].errors);
 return `<section class="panel stack"><h2>Character recall</h2><p class="subtle">Weakest characters first, using the last 20 explicit grades with greater weight on recent attempts. Scores accumulate gradually across words. Unrated characters are unknown; no drawings are retained.</p>${chars.length?chars.map(x=>`<div class="stat-feedback-row"><strong>${esc(x.character)}</strong><span>${x.score==null?'Unscored':x.score.toFixed(2)} · ${(x.weakness*100).toFixed(0)}% weakness · ${x.total} ratings · ${x.words} words</span></div>`).join(''):'<p>No character feedback yet. Mark characters after revealing a drawing.</p>'}</section><section class="panel stack"><h2>Grammar families</h2><p class="subtle">Last 20 checked Particle Zoo answers per family. Errors modestly increase selection weight among eligible exercises; due cards still come first.</p>${families.length?families.map(([name,x])=>`<div class="stat-feedback-row"><strong>${esc(name)}</strong><span>${x.errors} errors / ${x.total} checked · ${Object.entries(x.types).map(([k,n])=>esc(k)+': '+n).join(' · ')}</span></div>`).join(''):'<p>Complete Particle Zoo exercises to see family feedback.</p>'}</section>`;
}
