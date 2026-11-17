import {DECKS} from './deck-catalog.js';
import {MODEL,scheduleReview,retrievability,dueLabel,previewIntervals} from './fsrs.js';
import {loadState,saveState,defaultState,normalizeCard,makeBackup,parseBackup,migrateState,mergeDeck,makeDeck,clearLearningRecords} from './storage.js';
import {normalizeGrammar,parseSegments,plainSentence,grammarTags,linkedWords,requiredWords,grammarScores,wordKnowledge,toneTargets,grammarMistakes} from './grammar.js';

const $=selector=>document.querySelector(selector);
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
let state=null,page='home',studyMode='words',revealed=false,toneSelections=[],lastFinished=null,grammarFeedback=null;
let currentModal=null,pendingBackupRevision=null,saving=false,toastTimer;
const filters={words:{search:'',tags:{},op:'>=',rating:'any'},grammar:{search:'',tags:{},knowledgeOp:'>=',knowledgeValue:0,usageOp:'>=',usageValue:0}};
const wordById=id=>state.cards.find(c=>c.id===id);
const grammarById=id=>state.grammar.find(g=>g.id===id);
const isDue=(id,now=Date.now())=>!!state.schedules[id]&&Date.parse(state.schedules[id].dueAt)<=now;
const countDue=()=>state.cards.filter(c=>isDue(c.id)).length;
const countLearned=()=>state.cards.filter(c=>state.schedules[c.id]?.reps>0).length;
const countNew=()=>state.cards.length-countLearned();
const backupNeeded=()=>state.revision>state.backedUpRevision;
const countReadyGrammar=()=>state.grammar.filter(g=>scoreGrammar(g).ready).length;
const recall=s=>s?(retrievability(s)??0):0;
const scoreWord=c=>wordKnowledge(state.schedules[c.id],recall(state.schedules[c.id]));
const scoreGrammar=g=>grammarScores(g,state.cards,state.schedules,recall);
const tagsFor=kind=>[...new Set((kind==='words'?state.cards.map(c=>c.tags):state.grammar.map(g=>grammarTags(g,state.cards))).flat())].sort();
const tagHtml=text=>`<span class="tag">#${esc(text)}</span>`;
function toast(message){clearTimeout(toastTimer);toastNode.textContent=message;toastNode.classList.add('show');toastTimer=setTimeout(()=>toastNode.classList.remove('show'),3600);}
async function change(mutator,shouldRender=true){
  if(saving)return false;
  saving=true;
  const draft=structuredClone(state);
  try{mutator(draft);draft.revision=(draft.revision||0)+1;await saveState(draft,state.revision);state=draft;if(shouldRender)render();return true;}
  catch(error){toast(`Not saved: ${error.message}`);return false;}
  finally{saving=false;}
}
function shell(content){
  const nav=[['home','home','Home'],['study','cards','Study'],['browse','book','Words'],['grammar','layers','Grammar'],['stats','chart','Stats']];
  const hideNav=page==='complete'||(page==='study'&&(state.activeSession||state.activeGrammarSession));
  return `<header class="topbar"><div class="brand"><span class="brand-mark">词</span><span>Cíyán<small>Words that stay</small></span></div><div class="header-actions">
      <button class="icon-btn" data-action="backup" aria-label="Backup progress">${icon('archive')}${backupNeeded()?'<span class="dot"></span>':''}</button>
      <button class="icon-btn" data-action="navigate" data-page="settings" aria-label="Settings">${icon('settings')}</button></div></header>
      <main id="main">${content}</main>${hideNav?'':`<nav class="bottom-nav" aria-label="Main navigation">${nav.map(([dest,ico,title])=>
      `<button class="nav-item ${page===dest?'active':''}" data-action="navigate" data-page="${dest}" aria-label="${title}" ${page===dest?'aria-current="page"':''}>${icon(ico)}<span>${title}</span></button>`).join('')}</nav>`}`;
}
function backupBanner(){return backupNeeded()?`<div class="backup-banner">${icon('shield')}<p><strong>Changes not backed up.</strong> Your study data is saved locally. Export it to Files to protect it.</p><button data-action="backup">Backup</button></div>`:'';}
function renderHome(){
  const due=countDue(),fresh=countNew(),learned=countLearned();
  const today=state.history.filter(h=>dateKey(h.at)===formatDay()).length;
  const hr=new Date().getHours(),hello=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
  const resume=!!state.activeSession||!!state.activeGrammarSession;
  return `<div class="eyebrow">${hello} · 你好</div><h1 class="h1">Little words.<br>Big conversations.</h1>
    <p class="lead">A word garden, now with sentences to put them to work.</p>
    <section class="hero"><div class="eyebrow">YOUR DAILY PRACTICE</div><h2>${resume?'Your session is waiting.':due+fresh?'Ready for a little progress?':'You are all caught up!'}</h2>
      <p>${resume?'Pick up where you left off. Reviews are saved as you go.':`${due} due · ${fresh} new words · No daily introduction limit.`}</p>
      <button class="btn btn-light" data-action="start" data-mode="${state.activeGrammarSession?'grammar':'words'}">${icon('spark')}${resume?'Continue studying':'Study words'}</button></section>
    <div class="metrics"><div class="metric">${icon('clock')}<div class="num">${due}</div><div class="label">Due now</div></div>
      <div class="metric">${icon('book')}<div class="num">${learned}</div><div class="label">Words seen</div></div>
      <div class="metric">${icon('flame')}<div class="num">${today}</div><div class="label">Reviews today</div></div></div>
    ${backupBanner()}<button class="btn btn-secondary btn-full" data-action="navigate" data-page="decks">Explore optional decks</button>
    <div class="section-row"><h2 class="section-title">Learn in context</h2><button class="text-link" data-action="navigate" data-page="grammar">Explore grammar ${icon('right')}</button></div>
    <div class="panel stack"><div class="row"><div><strong>${countReadyGrammar()} of ${state.grammar.length} grammar examples unlocked</strong><div class="subtle" style="margin-top:5px">New examples unlock once their words and distractors are familiar.</div></div><span class="tag alt">${percent(state.grammar.length?countReadyGrammar()/state.grammar.length:0)}</span></div>
      <button class="btn btn-secondary btn-full" data-action="start" data-mode="grammar">${icon('layers')}Study sentence order</button></div>
    <div class="section-row"><h2 class="section-title">Your vocabulary</h2><button class="text-link" data-action="navigate" data-page="browse">See all ${state.cards.length} ${icon('right')}</button></div>
    <div class="panel"><div class="row"><strong>${learned} of ${state.cards.length} words encountered</strong><span class="tag">${percent(state.cards.length?learned/state.cards.length:0)}</span></div>
      <div class="progress-group"><div class="progress-track"><div class="progress-fill" style="width:${state.cards.length?100*learned/state.cards.length:0}%"></div></div></div></div>
    <div class="section-row"><h2 class="section-title">Explore a topic</h2></div>
    <div class="category-scroll">${tagsFor('words').slice(0,9).map(t=>`<button class="pill" data-action="open-tag" data-tag="${esc(t)}"># ${esc(t)}</button>`).join('')}</div>
    <div class="word-grid">${state.cards.filter(c=>c.tags.some(t=>t==='social'||t==='food')).slice(0,4).map(c=>`<button class="word-tile" data-action="card-detail" data-id="${esc(c.id)}"><div class="hanzi">${esc(c.hanzi)}</div><div class="pinyin">${esc(c.pinyin)}</div><div class="translation">${esc(c.english)}</div></button>`).join('')}</div>`;
}
function availableWordQueue(){
  const due=state.cards.filter(c=>isDue(c.id)).sort((a,b)=>Date.parse(state.schedules[a.id].dueAt)-Date.parse(state.schedules[b.id].dueAt));
  const fresh=state.cards.filter(c=>!state.schedules[c.id]);
  const size=state.settings.sessionSize;
  const dueCap=Math.max(1,Math.floor(size*.7));
  const mix=[...due.slice(0,dueCap),...fresh.slice(0,size-dueCap),...due.slice(dueCap),...fresh.slice(Math.max(0,size-dueCap))];
  return [...new Set(mix.map(c=>c.id))].slice(0,size);
}
async function startSession(mode='words'){
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
    if(!queue.length){page='study';studyMode='words';render();toast('No words due. You can import more vocabulary.');return;}
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
  const previous=state.schedules[id]||null,now=Date.now(),after=scheduleReview(previous,grade,now,state.settings.desiredRetention);
  const first=!previous,completed=state.activeSession.queue.length<=1;
  const done=await change(d=>{
    d.schedules[id]=after;
    d.history.push({id:crypto.randomUUID(),cardId:id,at:new Date(now).toISOString(),grade,first,previousDueAt:previous?.dueAt||null,
      nextDueAt:after.dueAt,model:MODEL,toneResult:tone?{expected:tone.expected,selected:tone.chosen,correct:tone.wrong.length===0}:null});
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
function renderStudyIntro(){
  const ready=countReadyGrammar(),unready=state.grammar.length-ready;
  return `<div class="page-heading"><div class="eyebrow">STUDY MODE</div><h1 class="h1">Learn it.<br>Then use it.</h1><p class="lead">Two complementary ways to build confidence.</p></div>
    <div class="mode-grid"><div class="panel mode-panel">${icon('book')}<h2>Vocabulary</h2><p>Recall the meaning and rate your memory. Study unlimited new words per day.</p>
      <div class="subtle">${countDue()} due · ${countNew()} new</div><button class="btn btn-primary btn-full" data-action="start" data-mode="words">Start word review</button></div>
      <div class="panel mode-panel">${icon('layers')}<h2>Grammar lab</h2><p>Build Mandarin sentences from shuffled words and confusing alternatives.</p>
      <div class="subtle">${ready} ready · ${unready} waiting on vocabulary</div><button class="btn btn-secondary btn-full" data-action="start" data-mode="grammar" ${!ready?'disabled':''}>Build sentences</button></div></div>
    <div class="notice" style="margin-top:15px"><strong>Ratings aren't levels:</strong> Again = forgot it; Hard = difficult recall; Good = remembered normally; Easy = effortless. Each rating changes the next review interval.</div>
    ${!ready?`<div class="notice warning" style="margin-top:12px">Grammar unlocks when every answer word and distractor reaches at least 75% estimated vocabulary knowledge. Rate those words Good or Easy first.</div>`:''}
    ${backupBanner()}`;
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
  const processed=s.results.length,previous=state.schedules[card.id],intervals=previewIntervals(previous,Date.now(),state.settings.desiredRetention);
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
    ${revealed?`<div class="eyebrow" style="text-align:center">HOW WELL DID YOU REMEMBER?</div><div class="review-controls">${ratingOptions.map(([cls,label,grade],i)=>
      `<button class="grade ${cls}" data-action="grade" data-grade="${grade}" ${grade===4&&state.settings.enforceTones&&badTone?'disabled':''}><strong>${label}</strong><span>${intervals[i]}</span></button>`).join('')}</div>
      <p class="study-captions">Again: forgot · Hard: struggled · Good: recalled · Easy: effortless</p>`:
      `<button class="btn btn-primary btn-full" data-action="reveal">Reveal answer ${icon('right')}</button>`}
    <div class="study-actions"><span class="subtle">${countDue()} due in your deck</span><button class="text-link" data-action="finish-prompt">Finish early</button></div>
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
  if(state.activeGrammarSession||grammarFeedback)return renderGrammarStudy();
  if(state.activeSession)return renderWordStudy();
  return renderStudyIntro();
}
function renderComplete(){
  const s=lastFinished||[...state.sessions,...state.grammarSessions].sort((a,b)=>Date.parse(a.endedAt)-Date.parse(b.endedAt)).at(-1);
  if(!s)return '<div class="empty">No completed session yet.</div>';
  const grammar=s.mode==='grammar';
  return `<div class="eyebrow" style="text-align:center;margin-top:34px">SESSION COMPLETE</div>
    <div class="complete-art"><span class="big-symbol">好</span></div><h1 class="complete-title">You showed up.<br>That matters.</h1>
    <p class="complete-subtitle">${grammar?'Sentence practice turns familiar words into useful Chinese.':'Every word you practice makes the next conversation easier.'}</p>
    <div class="complete-stats"><div><strong>${s.total}</strong><span>${grammar?'Sentences':'Reviewed'}</span></div>
      <div><strong>${grammar?countReadyGrammar():s.newWords}</strong><span>${grammar?'Unlocked':'New words'}</span></div>
      <div><strong>${s.total?Math.round(100*s.correct/s.total):0}%</strong><span>${grammar?'Correct':'Good / Easy'}</span></div></div>
    <div class="panel stack"><div class="row"><strong>${icon('shield')} Protect your progress</strong><span class="tag alt">Important</span></div>
      <p class="lead" style="font-size:13px">Your reviews are saved locally, but only a separate JSON file in Files protects against browser storage loss.</p>
      <button class="btn btn-primary btn-full" data-action="backup">${icon('download')}Save progress to Files</button>
      ${backupNeeded()?'<div class="notice warning">Your latest reviews have not been confirmed as backed up.</div>':'<div class="notice">Your current changes are marked as backed up.</div>'}
      <button class="btn btn-secondary btn-full" data-action="navigate" data-page="study">Study again</button>
      <button class="text-link" data-action="navigate" data-page="home" style="text-align:center">Back to home</button></div>`;
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
    <div id="active-tag-filter" class="active-tags"></div><div id="tag-filter" class="category-scroll"></div>
    <div class="filter-controls">${grammar?`<div class="filter-line"><span>Knowledge</span>
       <select aria-label="Knowledge comparison" data-filter="knowledgeOp" data-kind="grammar">${compareOptions(f.knowledgeOp)}</select>
       <select aria-label="Knowledge percentage" data-filter="knowledgeValue" data-kind="grammar">${options(Array.from({length:21},(_,i)=>[i*5,`${i*5}%`]),f.knowledgeValue)}</select></div>
       <div class="filter-line"><span>Usage risk</span>
       <select aria-label="Usage comparison" data-filter="usageOp" data-kind="grammar">${compareOptions(f.usageOp)}</select>
       <select aria-label="Usage percentage" data-filter="usageValue" data-kind="grammar">${options(Array.from({length:21},(_,i)=>[i*5,`${i*5}%`]),f.usageValue)}</select></div>`:
       `<div class="filter-line"><span>Last rating</span>
       <select aria-label="Rating comparison" data-filter="op" data-kind="words">${compareOptions(f.op)}</select>
       <select aria-label="Rating filter" data-filter="rating" data-kind="words">${options([['any','Any'],...ratingLabels.map((r,i)=>[i,r])],f.rating)}</select></div>`}</div>
    ${grammar?`<p class="subtle">Knowledge is estimated from the sentence's vocabulary. Usage risk is 0% for now; grammar mistakes are recorded for future scoring. Combined ranking = knowledge × (1 − usage risk).</p>`:
       `<p class="subtle">Again, Hard, Good, and Easy are review ratings, not linear learning stages. Filtering compares each word's <strong>most recent rating</strong>; Unseen is 0.</p>`}
    <div class="row" style="margin:15px 0 12px"><div id="browse-count" class="filter-count"></div>
      <button class="text-link" data-action="new-entry" data-kind="${kind}">${icon('plus')} Add ${grammar?'sentence':'word'}</button></div>
    ${!grammar?'<button class="btn btn-secondary btn-full" data-action="study-filtered">Study matching words</button>':''}<div id="collection-list"></div>${backupBanner()}`;
}
function matchesTags(entryTags,filtersMap){return Object.entries(filtersMap).every(([tag,value])=>value===0||(value===1?entryTags.includes(tag):!entryTags.includes(tag)));}
let visibleWords=80;
function updateCollection(keepPage=false){
  if(!keepPage)visibleWords=80;
  const kind=page==='grammar'?'grammar':'words',f=filters[kind],tags=tagsFor(kind);
  const positives=tags.filter(t=>f.tags[t]===1),negatives=tags.filter(t=>f.tags[t]===-1),active=[...positives,...negatives];
  const activeNode=$('#active-tag-filter'),availableNode=$('#tag-filter');if(!activeNode||!availableNode)return;
  activeNode.innerHTML=active.length?active.map(t=>`<button class="pill ${f.tags[t]===1?'include':'exclude'}" data-action="cycle-tag" data-kind="${kind}" data-tag="${esc(t)}">${f.tags[t]===1?'✓':'−'} # ${esc(t)}</button>`).join(''):
    '<span class="subtle">No active tags. Tap a topic to include it.</span>';
  availableNode.innerHTML=tags.filter(t=>!f.tags[t]).map(t=>`<button class="pill" data-action="cycle-tag" data-kind="${kind}" data-tag="${esc(t)}"># ${esc(t)}</button>`).join('');
  const q=f.search.trim().toLowerCase();
  if(kind==='words'){
    const results=state.cards.filter(c=>matchesTags(c.tags,f.tags)&&
      (f.rating==='any'||compare(state.schedules[c.id]?.lastRating||0,f.op,Number(f.rating)))&&
      (!q||[c.hanzi,c.pinyin,c.english,...c.tags].join(' ').toLowerCase().includes(q)));
    $('#browse-count').textContent=`${results.length} of ${state.cards.length} words`;
    $('#collection-list').innerHTML=results.length?results.slice(0,visibleWords).map(c=>{
      const schedule=state.schedules[c.id];
      return `<button class="list-card" data-action="card-detail" data-id="${esc(c.id)}"><div class="list-hanzi">${esc(c.hanzi)}<small>${esc(c.pinyin)}</small></div>
       <div class="list-detail"><strong>${esc(c.english)}</strong><small>${esc(c.tags.slice(0,3).map(x=>'#'+x).join('  '))} · ${esc(dueLabel(schedule))}</small></div>
       <div class="list-meta"><strong>${percent(scoreWord(c))}</strong><small>${schedule?ratingLabels[schedule.lastRating]:'New'}</small></div>${icon('right')}</button>`;
    }).join('')+(results.length>visibleWords?'<button class="btn btn-secondary btn-full" data-action="more-words">Show more words</button>':''):'<div class="empty"><strong>No matching words</strong>Adjust a filter or add a new word.</div>';
  }else{
    const results=state.grammar.map(g=>({g,score:scoreGrammar(g),tags:grammarTags(g,state.cards)}))
      .filter(({g,score,tags})=>matchesTags(tags,f.tags)&&compare(Math.round(score.knowledge*100),f.knowledgeOp,Number(f.knowledgeValue))&&
        compare(Math.round(score.usage*100),f.usageOp,Number(f.usageValue))&&
        (!q||[plainSentence(g.markup),g.markup,g.english,g.pinyin,...tags].join(' ').toLowerCase().includes(q)))
      .sort((a,b)=>b.score.combined-a.score.combined||a.g.english.localeCompare(b.g.english));
    $('#browse-count').textContent=`${results.length} of ${state.grammar.length} sentences`;
    $('#collection-list').innerHTML=results.length?results.map(({g,score,tags})=>`<button class="list-card grammar-list" data-action="grammar-detail" data-id="${esc(g.id)}">
      <div class="list-detail"><strong class="grammar-preview">${esc(plainSentence(g.markup))}</strong><small>${esc(g.english)}</small>
      <small>${esc(tags.slice(0,4).map(t=>'#'+t).join('  '))}</small></div><div class="list-meta"><strong>${percent(score.combined)}</strong>
      <small>${score.ready?'Ready':'Locked'}</small></div>${icon('right')}</button>`).join(''):
        '<div class="empty"><strong>No matching sentences</strong>Change your filters or add a grammar card.</div>';
  }
}
function renderStats(){
  const total=state.history.length,good=state.history.filter(h=>h.grade>=3).length;
  const allReviews=[...state.history,...state.grammarHistory];
  const days=new Set(allReviews.map(h=>dateKey(h.at)));
  const d=new Date();if(!days.has(formatDay(d)))d.setDate(d.getDate()-1);
  let streak=0;while(days.has(formatDay(d))){streak++;d.setDate(d.getDate()-1);}
  const series=Array.from({length:7},(_,i)=>{const day=new Date();day.setDate(day.getDate()-6+i);return {label:day.toLocaleDateString(undefined,{weekday:'short'}),day:formatDay(day),count:allReviews.filter(h=>dateKey(h.at)===formatDay(day)).length};});
  const max=Math.max(1,...series.map(x=>x.count));
  const seen=state.cards.filter(c=>state.schedules[c.id]);
  const strength=seen.length?seen.reduce((a,c)=>a+recall(state.schedules[c.id]),0)/seen.length:0;
  const grammarCorrect=state.grammarHistory.filter(h=>h.correct).length;
  const sessions=[...state.sessions,...state.grammarSessions].sort((a,b)=>Date.parse(b.endedAt)-Date.parse(a.endedAt));
  return `<div class="page-heading"><div class="eyebrow">THE LONG GAME</div><h1 class="h1">Look how far<br>you've come.</h1><p class="lead">A history of the words and sentences you have practiced.</p></div>
    <div class="stat-overview"><div class="stat-block">${icon('book')}<strong>${countLearned()}</strong><span>Words encountered</span></div>
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
    <div class="list-detail"><strong>${new Date(s.endedAt).toLocaleDateString()}</strong><small>${s.mode==='grammar'?'Grammar':'Vocabulary'} · ${s.total} attempts · ${s.total?Math.round(100*s.correct/s.total):0}% success</small></div></div>`).join(''):'<div class="empty">Your completed sessions will appear here.</div>'}`;
}
function renderSettings(){const s=state.settings;
  return `<div class="page-heading"><div class="eyebrow">MAKE IT YOURS</div><h1 class="h1">Your practice,<br>your pace.</h1><p class="lead">Adjust the experience and keep your learning safe.</p></div>
   <div class="section-row"><h2 class="section-title">Study preferences</h2></div>
   <div class="panel"><div class="settings-row"><div><strong>New words per day</strong><small>No daily limit; your session size is the only batch limit</small></div><span class="tag">Unlimited</span></div>
    <div class="settings-row"><div><strong>Cards per session</strong><small>1–500 reviews in a session</small></div><input type="number" min="1" max="500" data-setting="sessionSize" value="${s.sessionSize}" aria-label="Cards per session"></div>
    <div class="settings-row"><div><strong>Target retention</strong><small>Higher means more frequent reviews</small></div><select data-setting="desiredRetention">${options([[.85,'85%'],[.9,'90%'],[.95,'95%']],s.desiredRetention)}</select></div>
    <div class="settings-row"><div><strong>Show pinyin on front</strong><small>Word meaning is still hidden</small></div><input class="toggle" type="checkbox" role="switch" data-setting="showPinyinPrompt" ${s.showPinyinPrompt?'checked':''}></div>
    <div class="settings-row"><div><strong>Tone test</strong><small>Choose tone 1–4 below each Chinese character; none = neutral</small></div><input class="toggle" type="checkbox" role="switch" data-setting="toneTest" ${s.toneTest?'checked':''}></div>
    <div class="settings-row"><div><strong>Enforce tone accuracy</strong><small>When tone test is on, a mismatch disables Easy</small></div><input class="toggle" type="checkbox" role="switch" data-setting="enforceTones" ${s.enforceTones?'checked':''}></div></div>
   <div class="section-row"><h2 class="section-title">Optional decks</h2></div><div class="panel stack"><p>Load topics when you want them. Existing words and review history are preserved.</p><button class="btn btn-primary btn-full" data-action="navigate" data-page="decks">Browse available decks</button></div>
   <div class="section-row"><h2 class="section-title">Your files</h2><span class="subtle">Stored locally on this device</span></div>
   <div class="panel stack"><div class="notice ${backupNeeded()?'warning':''}">${backupNeeded()?'Changes are not confirmed in an exported backup.':'Your current progress is marked as backed up.'}</div>
     <button class="btn btn-primary btn-full" data-action="backup">${icon('download')}Export full progress backup</button>
     <button class="btn btn-secondary btn-full" data-action="restore">${icon('upload')}Restore full backup (replace)</button>
     <button class="btn btn-secondary btn-full" data-action="import-deck">${icon('plus')}Import word / grammar deck (merge)</button>
     <button class="btn btn-secondary btn-full" data-action="export-deck">${icon('archive')}Export deck (no review records)</button>
     <button class="btn btn-secondary btn-full" data-action="template">${icon('book')}Download deck template</button>
     <p class="subtle">Deck imports add missing words/sentences and may add tags to matching words. They never overwrite existing cards or progress. Backups include every card, sentence, schedule, and review.</p>
     <p class="subtle">Last confirmed export: ${esc(labelDate(state.lastBackupAt))}</p></div>
   <div class="section-row"><h2 class="section-title">Danger zone</h2></div>
   <div class="panel stack"><p class="lead" style="font-size:13px">Clear review records and progress while retaining every vocabulary and grammar entry. You must type <strong>delete</strong> to confirm.</p>
     <button class="btn btn-danger" data-action="clear-data">${icon('trash')}Clear learning records</button></div>
   <div class="section-row"><h2 class="section-title">About Cíyán</h2></div>
   <div class="panel"><p class="lead" style="font-size:13px">Cíyán v0.3.2 · Offline-first, local-only, ${MODEL} vocabulary reviews. No accounts, cloud sync, or background uploads.</p>
     <p class="subtle">Browser data may be removed by iOS. Export after each session and keep the JSON in Files or iCloud Drive. Grammar usage risk is reserved at 0% until its future scoring model is designed.</p></div>`;
}
function render(){if(!state)return;const views={home:renderHome,study:renderStudy,complete:renderComplete,browse:()=>renderCollection('words'),grammar:()=>renderCollection('grammar'),stats:renderStats,settings:renderSettings,decks:renderDecks};
  app.innerHTML=shell((views[page]||renderHome)());if(['browse','grammar'].includes(page))updateCollection();}
function navigate(dest){if(!['home','study','browse','grammar','stats','settings','complete','decks'].includes(dest))return;
  page=dest;revealed=false;render();window.scrollTo({top:0,behavior:'instant'});}
function modal(title,contents){closeModal();currentModal=document.createElement('div');currentModal.className='modal-backdrop';
  currentModal.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon('x')}</button></div><div class="modal-scroll">${contents}</div></div>`;
  document.body.append(currentModal);currentModal.querySelector('input:not([type=file]),button')?.focus();}
function closeModal(){if(currentModal){currentModal.remove();currentModal=null;}}
function wordDetails(id){const c=wordById(id);if(!c)return;const schedule=state.schedules[id],history=state.history.filter(h=>h.cardId===id);
  const examples=state.grammar.filter(g=>linkedWords(g,[c]).length).sort((a,b)=>scoreGrammar(b).combined-scoreGrammar(a).combined);
  const knowledge=scoreWord(c);
  modal('Word in context',`<div class="detail-hero"><div class="review-hanzi">${esc(c.hanzi)}</div><div class="review-pinyin">${esc(c.pinyin)}</div><div class="review-english">${esc(c.english)}</div></div>
    <div class="tags-wrap">${c.tags.map(tagHtml).join('')||'<span class="subtle">No tags</span>'}</div>
    <div class="detail-stats"><div><strong>${percent(knowledge)}</strong><span>Knowledge score</span></div>
      <div><strong>${history.length}</strong><span>Times encountered</span></div>
      <div><strong>${schedule?ratingLabels[schedule.lastRating]:'New'}</strong><span>Last rating</span></div>
      <div><strong>${schedule?`${schedule.stability.toFixed(1)}d`:'—'}</strong><span>Stability</span></div></div>
    <div class="panel stack" style="margin:0 0 16px"><div class="row"><span class="subtle">Last encountered</span><strong>${schedule?esc(labelDate(schedule.lastReviewedAt)):'Never'}</strong></div>
      <div class="row"><span class="subtle">Next scheduled</span><strong>${esc(dueLabel(schedule))}</strong></div>
      <div class="row"><span class="subtle">Memory lapses</span><strong>${schedule?.lapses||0}</strong></div></div>
    <div class="section-row"><h3 class="section-title">In context · ${examples.length} sentences</h3></div>
    ${examples.length?examples.map(g=>`<button class="context-card" data-action="grammar-detail" data-id="${esc(g.id)}"><strong>${esc(plainSentence(g.markup))}</strong>
       <small>${esc(g.pinyin)}</small><span>${esc(g.english)}</span><div class="row"><span class="subtle">Combined: ${percent(scoreGrammar(g).combined)}</span>${icon('right')}</div></button>`).join(''):
      '<div class="notice">No grammar sentences containing this word yet. Add one from the Grammar page.</div>'}
    <div class="modal-actions"><button class="btn btn-secondary" data-action="edit-card" data-id="${esc(id)}">${icon('edit')}Edit</button>
      <button class="btn btn-danger" data-action="delete-card" data-id="${esc(id)}">${icon('trash')}Delete</button></div>`);
}
function grammarDetails(id){const g=grammarById(id);if(!g)return;const scores=scoreGrammar(g),tags=grammarTags(g,state.cards);
  const history=state.grammarHistory.filter(h=>h.grammarId===id),correct=history.filter(h=>h.correct).length;
  modal('Grammar in context',`<div class="panel stack"><div class="eyebrow">SENTENCE</div><div class="grammar-detail-hanzi">${esc(plainSentence(g.markup))}</div>
    <div class="review-pinyin">${esc(g.pinyin)}</div><strong>${esc(g.english)}</strong></div>
    <div class="tags-wrap" style="margin:16px 0">${tags.map(tagHtml).join('')||'<span class="subtle">No inherited tags (add matching word cards)</span>'}</div>
    <div class="detail-stats"><div><strong>${percent(scores.knowledge)}</strong><span>Knowledge</span></div>
      <div><strong>${percent(scores.usage)}</strong><span>Usage risk</span></div>
      <div><strong>${percent(scores.combined)}</strong><span>Combined</span></div>
      <div><strong>${history.length?`${correct}/${history.length}`:'0'}</strong><span>Grammar correct</span></div></div>
    <div class="panel stack" style="margin-bottom:15px"><strong>${scores.ready?'Ready for grammar study':'Not yet unlocked'}</strong>
      <p class="subtle">Words and distractors must each reach 75% knowledge; missing or unfamiliar words:</p>
      <div class="tags-wrap">${scores.weak.map(x=>`<span class="tag alt">${esc(x.word)}${x.card?'':' (not in words)'}</span>`).join('')||'<span class="subtle">None</span>'}</div>
      <div class="subtle">Distractors (1-based answer token): ${esc(g.distractors.map(d=>`${d.index}: [${d.word}]`).join(', ')||'none')}</div></div>
    <div class="modal-actions"><button class="btn btn-secondary" data-action="edit-grammar" data-id="${esc(id)}">${icon('edit')}Edit</button>
     <button class="btn btn-danger" data-action="delete-grammar" data-id="${esc(id)}">${icon('trash')}Delete</button></div>`);
}
function wordEditor(id=null){const c=id?wordById(id):{hanzi:'',pinyin:'',english:'',tags:[]};if(!c)return;
  modal(id?'Edit word':'Add a word',`<form id="word-form" data-id="${id?esc(id):''}">
     <div class="form-grid"><div class="form-field"><label for="hanzi">Chinese characters *</label><input id="hanzi" name="hanzi" required maxlength="120" value="${esc(c.hanzi)}"></div>
       <div class="form-field"><label for="pinyin">Pinyin</label><input id="pinyin" name="pinyin" maxlength="160" value="${esc(c.pinyin)}"></div></div>
     <div class="form-field"><label for="english">English *</label><input id="english" name="english" required maxlength="500" value="${esc(c.english)}"></div>
     <div class="form-field"><label for="tags">Tags</label><input id="tags" name="tags" value="${esc(c.tags.join(', '))}" placeholder="food, social"><span class="help">Comma-separated. Grammar tags are inherited from linked words.</span></div>
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
  if(existing?.hanzi!==candidate.hanzi&&state.schedules[id]&&
    !window.confirm('You changed the Chinese word of a studied card. Keep its existing memory history for the new spelling?'))return;
  const done=await change(d=>{if(id){const i=d.cards.findIndex(c=>c.id===id);if(i<0)throw new Error('Word no longer exists');d.cards[i]=candidate;}
    else d.cards.push(candidate);});
  if(done){closeModal();toast(id?'Word edited':'Word added');}
}
async function saveGrammarEditor(form){const id=form.dataset.id||null,existing=id?grammarById(id):null;
  let candidate;try{candidate=normalizeGrammar({...existing,...Object.fromEntries(new FormData(form)),id:id||undefined,source:existing?.source||'My grammar'});}catch(e){toast(e.message);return;}
  if(state.grammar.some(g=>g.id!==id&&g.markup===candidate.markup)){toast('That sentence is already in your grammar collection.');return;}
  if(existing?.markup!==candidate.markup&&state.grammarHistory.some(h=>h.grammarId===id)&&
      !window.confirm('Changing this studied sentence will keep its prior attempt history. Continue?'))return;
  const done=await change(d=>{if(id){const i=d.grammar.findIndex(g=>g.id===id);if(i<0)throw new Error('Grammar card no longer exists');d.grammar[i]=candidate;}
    else d.grammar.push(candidate);});
  if(done){closeModal();toast(id?'Grammar edited':'Grammar card created');}
}
async function deleteWord(id){const c=wordById(id);if(!c)return;
  const uses=state.grammar.filter(g=>linkedWords(g,[c]).length).length;
  if(!window.confirm(`Delete “${c.hanzi}” and all of its vocabulary reviews? ${uses} linked grammar sentences will remain but may be locked until a replacement word is added. This is irreversible without a backup.`))return;
  if(await change(d=>{d.cards=d.cards.filter(c=>c.id!==id);delete d.schedules[id];d.history=d.history.filter(h=>h.cardId!==id);
    d.activeSession?.queue&&(d.activeSession.queue=d.activeSession.queue.filter(x=>x!==id));
    if(d.activeSession&&!d.activeSession.queue.length)d.activeSession=null;})){closeModal();toast('Word deleted');}
}
async function deleteGrammar(id){const g=grammarById(id);if(!g)return;
  if(!window.confirm(`Delete grammar sentence “${plainSentence(g.markup)}” and its ${state.grammarHistory.filter(h=>h.grammarId===id).length} attempts? This cannot be undone without a backup.`))return;
  if(await change(d=>{d.grammar=d.grammar.filter(g=>g.id!==id);d.grammarHistory=d.grammarHistory.filter(h=>h.grammarId!==id);
    d.activeGrammarSession?.queue&&(d.activeGrammarSession.queue=d.activeGrammarSession.queue.filter(x=>x!==id));
    if(d.activeGrammarSession&&!d.activeGrammarSession.queue.length)d.activeGrammarSession=null;})){closeModal();toast('Grammar sentence deleted');}
}
function clearDataModal(){modal('Clear learning records?',`<div class="notice error"><strong>This removes all review history, schedules, grades, streaks, grammar attempts, and active sessions.</strong> It keeps your vocabulary and grammar cards, as well as your settings. Export a backup first if you want to preserve your progress.</div>
  <div class="form-field" style="margin-top:18px"><label for="clear-confirm">Type <strong>delete</strong> to confirm</label>
  <input id="clear-confirm" placeholder="delete" autocomplete="off" spellcheck="false"></div>
  <div class="modal-actions"><button class="btn btn-secondary" data-action="close-modal">Cancel</button>
    <button class="btn btn-danger" id="clear-confirm-button" data-action="confirm-clear" disabled>Clear records</button></div>`);}
async function clearData(){if($('#clear-confirm')?.value!=='delete')return;
  const done=await change(d=>clearLearningRecords(d),false);
  if(done){closeModal();lastFinished=null;grammarFeedback=null;revealed=false;page='home';render();toast('Learning records cleared; cards retained. Export your new backup.');}
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
function backupFile(){const content=JSON.stringify(makeBackup(state),null,2);
  return new File([content],`ciyan-progress-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,{type:'application/json'});}
async function exportBackup(mode){const file=backupFile(),revision=state.revision;
  try{
    if(mode==='share'&&navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Cíyán complete backup'});
    else{downloadFile(file,file.name);if(mode==='share')toast('Share is unavailable; a JSON download was started');}
    pendingBackupRevision=revision;
    const area=$('#backup-confirm-area');if(area)area.innerHTML=`<div class="notice" style="margin-top:8px">File prepared: <strong>${esc(file.name)}</strong></div>
      <button class="btn btn-soft btn-full" style="margin-top:10px" data-action="confirm-backup">${icon('check')}I saved this file in Files</button>`;
  }catch(e){if(e.name!=='AbortError')toast(`Backup failed: ${e.message}`);}
}
async function confirmBackup(){if(pendingBackupRevision===null||saving)return;
  const candidate=structuredClone(state);candidate.backedUpRevision=Math.max(candidate.backedUpRevision,Math.min(candidate.revision,pendingBackupRevision));candidate.lastBackupAt=new Date().toISOString();
  try{await saveState(candidate,state.revision);state=candidate;pendingBackupRevision=null;closeModal();render();toast('Export confirmed. Keep that JSON file safe.');}
  catch(e){toast(`Could not save backup status: ${e.message}`);}
}
async function readJsonFile(file){if(!file)return null;if(file.size>40*1024*1024)throw new Error('JSON file exceeds 40 MB');
  try{return JSON.parse(await file.text());}catch{throw new Error('The file is not valid JSON');}}
function requestFile(kind){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.className='fileinput';document.body.append(input);
  input.addEventListener('change',async()=>{try{const content=await readJsonFile(input.files?.[0]);if(content){if(kind==='restore')await restoreBackup(content);else await importDeck(content);}}
    catch(error){toast(error.message);}finally{input.remove();}},{once:true});input.click();}
async function restoreBackup(content){if(saving)return;const parsed=parseBackup(content);
  if(!window.confirm(`REPLACE your entire current database with this backup? It contains ${parsed.cards.length} words, ${parsed.grammar.length} sentences, ${parsed.history.length} word reviews. Export your current progress first if needed.`))return;
  try{parsed.revision=state.revision+1;parsed.backedUpRevision=parsed.revision;await saveState(parsed,state.revision);state=parsed;page='home';revealed=false;grammarFeedback=null;lastFinished=null;closeModal();render();toast('Full backup restored.');}
  catch(e){toast(`Restore failed: ${e.message}`);}
}
async function importDeck(content){const result=mergeDeck(state,content);
  const {addedWords,addedGrammar,tagsUpdated}=result;
  if(!addedWords&&!addedGrammar&&!tagsUpdated){toast('Everything in this deck is already present. No changes made.');return;}
  if(!window.confirm(`Merge ${addedWords} new words, ${addedGrammar} grammar sentences and ${tagsUpdated} tag updates? No existing cards, reviews or scores will be replaced.`))return;
  const done=await change(d=>{d.cards=result.draft.cards;d.grammar=result.draft.grammar;});
  if(done){closeModal();toast(`Imported ${addedWords} words, ${addedGrammar} sentences, ${tagsUpdated} tag updates`);}
}
function exportDeck(){const data=makeDeck(state);
  downloadFile(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'ciyan-deck-v0.3.json');toast('Record-free deck JSON prepared');}
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
document.addEventListener('click',async event=>{
  if(currentModal&&event.target===currentModal){closeModal();return;}
  if(event.target.closest('.tone-option'))return; // selecting a tone must never reveal the answer
  if(suppressTileClick&&event.target.closest('[data-tile],[data-drop-slot]')){event.preventDefault();return;}
  const element=event.target.closest('[data-action]');if(!element)return;
  const action=element.dataset.action;
  switch(action){
    case 'navigate':closeModal();navigate(element.dataset.page);break;
    case 'start':await startSession(element.dataset.mode||'words');break;
    case 'reveal':revealed=true;render();break;
    case 'grade':await gradeCard(Number(element.dataset.grade));break;
    case 'finish-prompt':finishPrompt();break;
    case 'end-session':closeModal();await finishEarly();break;
    case 'open-tag':filters.words.tags={[element.dataset.tag]:1};filters.words.search='';navigate('browse');break;
    case 'cycle-tag':{const f=filters[element.dataset.kind],tag=element.dataset.tag,current=f.tags[tag]||0;
      if(current===0)f.tags[tag]=1;else if(current===1)f.tags[tag]=-1;else delete f.tags[tag];updateCollection();break;}
    case 'reset-tags':filters[element.dataset.kind].tags={};updateCollection();break;
    case 'card-detail':wordDetails(element.dataset.id);break;
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
    case 'load-deck':await loadBundledDeck(element.dataset.deck);break;
    case 'more-words':visibleWords+=80;updateCollection(true);break;
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
  if(event.target.matches('#word-form')){event.preventDefault();await saveWordEditor(event.target);}
  else if(event.target.matches('#grammar-form')){event.preventDefault();await saveGrammarEditor(event.target);}
});
document.addEventListener('input',event=>{
  if(event.target.id==='collection-search') {const kind=page==='grammar'?'grammar':'words';filters[kind].search=event.target.value;updateCollection();}
  if(event.target.id==='clear-confirm') {const b=$('#clear-confirm-button');if(b)b.disabled=event.target.value!=='delete';}
});
document.addEventListener('change',async event=>{
  if(event.target.dataset.toneIndex!==undefined){if(revealed)return;
    const i=Number(event.target.dataset.toneIndex),tone=Number(event.target.dataset.toneValue);
    toneSelections[i]=event.target.checked?tone:0;render();return;}
  if(event.target.dataset.filter){const kind=event.target.dataset.kind,key=event.target.dataset.filter;
    filters[kind][key]=key.endsWith('Value')?Number(event.target.value):event.target.value;updateCollection();return;}
  const key=event.target.dataset.setting;if(!key)return;
  let value=event.target.type==='checkbox'?event.target.checked:Number(event.target.value);
  if(key==='sessionSize')value=Math.max(1,Math.min(500,Math.round(value)||12));
  if(key==='desiredRetention')value=[.85,.9,.95].includes(value)?value:.9;
  await change(d=>{d.settings[key]=value;});
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&currentModal){closeModal();return;}
  if(['Enter',' '].includes(event.key)&&!revealed&&page==='study'&&event.target.closest('.review-card')&&!state.settings.toneTest){event.preventDefault();revealed=true;render();}
  if(page==='study'&&revealed&&!currentModal&&['1','2','3','4'].includes(event.key))gradeCard(Number(event.key));
});
async function boot(){try{
  const loaded=await loadState();
  if(!loaded){state=defaultState();await saveState(state);}
  else {
    state=migrateState(loaded);
    if(loaded.schemaVersion!==state.schemaVersion){await saveState(state);}
  }
  if(!Array.isArray(state.cards)||!Array.isArray(state.grammar)||!Array.isArray(state.history)||!state.schedules)throw new Error('Local data appears invalid. Import a JSON backup to restore it.');
  studyMode=state.activeGrammarSession?'grammar':'words';render();
  if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
  if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
}catch(error){app.innerHTML=`<div class="loading-state" style="text-align:center"><div class="brand-mark">!</div>
  <h2>Local storage unavailable</h2><p>${esc(error.message)}</p><p>Use Safari or the installed Home Screen app, not a private tab or file preview. No data was reset.</p>
  <button class="btn btn-secondary" onclick="location.reload()">Try again</button></div>`;}}
boot();

function renderDecks(){
  const names=new Set(state.cards.map(c=>c.hanzi));
  return `<div class="page-heading"><div class="eyebrow">GROW YOUR COLLECTION</div><h1 class="h1">Pick your<br>next topic.</h1><p class="lead">Optional decks. Load only what you want to study.</p></div>
  <div class="notice">HSK1, HSK2, and higher labels form one consistent set of level tags. Each deck is selective and includes supporting words needed for its grammar examples.</div>
  <p class="subtle">Importing adds words and tags without changing existing cards or progress. Reimporting is safe. All decks are included in the offline app download.</p>
  ${DECKS.map(d=>{const present=d.words.filter(w=>names.has(w)).length;return `<section class="panel stack" style="margin-top:14px"><div class="row"><h2 class="section-title">${esc(d.title)}</h2><span class="tag">${d.wordCount} words</span></div><p>${esc(d.description)}</p><div class="subtle">${present} words already in your collection${d.grammarCount?' · '+d.grammarCount+' grammar cards':''}</div><button class="btn btn-primary btn-full" data-action="load-deck" data-deck="${esc(d.id)}">Load / merge deck</button><a class="text-link" href="./decks/${esc(d.id)}.json" download>Download JSON</a></section>`;}).join('')}
  <p class="subtle"><a href="./decks/README.md">Deck guide and sources</a> · <a href="./decks/ATTRIBUTION.md">Data attribution</a></p>`;
}
async function loadBundledDeck(id){
  if(!DECKS.some(d=>d.id===id)||saving)return;
  try{const response=await fetch('./decks/'+encodeURIComponent(id)+'.json');if(!response.ok)throw new Error('Deck unavailable. Reopen online to cache the latest app.');await importDeck(await response.json());}
  catch(e){toast(e.message);}
}
async function startFilteredSession(){
  if(state.activeSession||state.activeGrammarSession){await startSession();return;}
  const f=filters.words,q=f.search.trim().toLowerCase();
  const matches=state.cards.filter(c=>matchesTags(c.tags,f.tags)&&(f.rating==='any'||compare(state.schedules[c.id]?.lastRating||0,f.op,Number(f.rating)))&&(!q||[c.hanzi,c.pinyin,c.english,...c.tags].join(' ').toLowerCase().includes(q)));
  const due=matches.filter(c=>isDue(c.id)).sort((a,b)=>Date.parse(state.schedules[a.id].dueAt)-Date.parse(state.schedules[b.id].dueAt));
  const queue=[...due,...matches.filter(c=>!state.schedules[c.id])].slice(0,state.settings.sessionSize).map(c=>c.id);
  if(!queue.length){toast('No new or due words match these filters.');return;}
  const session={id:crypto.randomUUID(),startedAt:new Date().toISOString(),queue,initialTotal:queue.length,results:[],newWords:0,correct:0};
  if(await change(d=>{d.activeSession=session;},false)){studyMode='words';page='study';revealed=false;toneSelections=[];render();}
}
