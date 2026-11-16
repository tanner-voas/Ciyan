import {MODEL, scheduleReview, retrievability, dueLabel, previewIntervals} from './fsrs.js';
import {loadState, saveState, defaultState, normalizeCard, makeBackup, parseBackup} from './storage.js';

const $ = sel => document.querySelector(sel);
const app = $('#app');
const toastNode = $('#toast');
let state = null;
let page = 'home';
let browseQuery = '';
let browseTag = 'all';
let currentModal = null;
let revealed = false;
let saving = false;
let pendingBackupRevision = null;
let lastFinished = null;
let toastTimer;

const shapes = {
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
  left:'<path d="m15 5-7 7 7 7"/>',
  x:'<path d="M5 5 19 19M19 5 5 19"/>',
  spark:'<path d="m12 2 2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1z"/>',
  flame:'<path d="M12 22c4.8 0 7.5-3.8 7.5-8.5 0-4.1-3.1-6.7-4-7.5.5 4.1-3 5.6-3 5.6C11.4 6.7 9.8 5 9 2 8 5.7 4.5 9.4 4.5 13.5 4.5 18.2 7.2 22 12 22z"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  refresh:'<path d="M20 11a8 8 0 0 0-14-5L3 9V3m0 6h6M4 13a8 8 0 0 0 14 5l3-3v6m0-6h-6"/>',
  book:'<path d="M12 7c-2-2-5-2-9-2v14c4 0 7 0 9 2m0-14c2-2 5-2 9-2v14c-4 0-7 0-9 2m0-14v14"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/>',
  edit:'<path d="m15 5 4 4M4 20l5-1 11-11a3 3 0 0 0-4-4L5 15z"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v7M14 11v7"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'
};
const icon = (name, cls='') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${shapes[name]||shapes.spark}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDay = (date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const dateKey = value => formatDay(new Date(value));
const isDue = (id, time=Date.now()) => !!state.schedules[id] && Date.parse(state.schedules[id].dueAt) <= time;
const countDue = () => state.cards.filter(c=>isDue(c.id)).length;
const countLearned = () => state.cards.filter(c=>state.schedules[c.id]?.reps > 0).length;
const countNew = () => state.cards.length - countLearned();
const todayNew = () => new Set(state.history.filter(h=>h.first && dateKey(h.at)===formatDay()).map(h=>h.cardId)).size;
const newRemaining = () => Math.max(0, state.settings.dailyNew - todayNew());
const backupNeeded = () => state.revision > state.backedUpRevision;
const allTags = () => [...new Set(state.cards.flatMap(c=>c.tags))].sort();
const cardById = id => state.cards.find(c=>c.id===id);
const fullTag = txt => `<span class="tag">${esc(txt)}</span>`;
const roundPercent = n => Math.round(100*n);
const strength = () => {
  const studied = state.cards.filter(c=>state.schedules[c.id]);
  if (!studied.length) return 0;
  return Math.round(100 * studied.reduce((a,c)=>a+(retrievability(state.schedules[c.id])||0),0)/studied.length);
};
function toast(msg) { clearTimeout(toastTimer); toastNode.textContent = msg; toastNode.classList.add('show'); toastTimer=setTimeout(()=>toastNode.classList.remove('show'),3300); }

// Commit the entire state in one IndexedDB transaction. The UI updates only after success.
async function change(mutator, shouldRender = true) {
  if (saving) return false;
  saving = true;
  const draft = structuredClone(state);
  try {
    mutator(draft);
    draft.revision += 1;
    await saveState(draft);
    state = draft;
    if (shouldRender) render();
    return true;
  } catch (error) {
    toast(`Not saved: ${error.message}`);
    return false;
  } finally { saving = false; }
}

function shell(content) {
  const navItems = [['home','home','Home'],['study','cards','Study'],['browse','book','Words'],['stats','chart','Stats']];
  const nav = navItems.map(([target,ico,label])=>`<button class="nav-item ${page===target?'active':''}" data-action="navigate" data-page="${target}" aria-label="${label}" ${page===target?'aria-current="page"':''}>${icon(ico)}<span>${label}</span></button>`).join('');
  const hideNav = ['study','complete'].includes(page) && (page==='complete' || state.activeSession);
  return `<header class="topbar"><div class="brand"><span class="brand-mark">词</span><span>Cíyán<small>Words that stay</small></span></div>
     <div class="header-actions">
        <button class="icon-btn" aria-label="Backup progress" title="Backup progress" data-action="backup">${icon('archive')}${backupNeeded()?'<span class="dot"></span>':''}</button>
        <button class="icon-btn" aria-label="Settings" title="Settings" data-action="navigate" data-page="settings">${icon('settings')}</button>
     </div></header>
     <main id="main">${content}</main>${hideNav?'':`<nav class="bottom-nav" aria-label="Main navigation">${nav}</nav>`}`;
}
function backupBanner() {
  return backupNeeded()? `<div class="backup-banner">${icon('shield')}<p><strong>Progress not backed up.</strong> Saved locally, but export a file to protect it.</p><button data-action="backup">Backup</button></div>` : '';
}
function greeting() { const hr=new Date().getHours(); return hr<12?'Good morning':hr<17?'Good afternoon':'Good evening'; }

function renderHome() {
  const due=countDue(), fresh=countNew(), already=todayNew(), canNew=Math.min(fresh,newRemaining());
  const available = due + canNew;
  const learned = countLearned();
  const reviewedToday=state.history.filter(h=>dateKey(h.at)===formatDay()).length;
  const resume = !!state.activeSession;
  const tags=allTags().slice(0,7);
  const spotlight=state.cards.filter(c=>c.tags.includes('social')||c.tags.includes('food')).slice(0,4);
  return `<div class="eyebrow">${esc(greeting())} · 你好</div>
    <h1 class="h1">Little words.<br/>Big conversations.</h1>
    <p class="lead">Build your Mandarin, one small moment at a time.</p>
    <section class="hero"><div class="eyebrow">YOUR DAILY PRACTICE</div>
      <h2>${resume?'Your session is waiting.':available?'Ready for a little progress?':'Looking good today!'}</h2>
      <p>${resume?'Pick up right where you left off. Every review is saved as you go.':available?`${due} due for review · ${canNew} new words ready to meet.`:'Nothing due right now. Your next reviews will appear automatically.'}</p>
      <button class="btn btn-light" data-action="start">${icon('spark')}${resume?'Continue studying':available?'Start learning':'Check for reviews'}</button></section>
    <div class="metrics"><div class="metric">${icon('clock')}<div class="num">${due}</div><div class="label">Due now</div></div>
      <div class="metric">${icon('book')}<div class="num">${learned}</div><div class="label">Words seen</div></div>
      <div class="metric">${icon('flame')}<div class="num">${reviewedToday}</div><div class="label">Reviews today</div></div></div>
    ${backupBanner()}
    <div class="section-row"><h2 class="section-title">Your growing vocabulary</h2><button class="text-link" data-action="navigate" data-page="browse">See all ${state.cards.length} ${icon('right','tiny-icon')}</button></div>
    <div class="panel"><div class="row"><div><strong>${learned} of ${state.cards.length} words discovered</strong><div class="subtle" style="margin-top:5px">${countNew()} words are waiting for their first hello</div></div><span class="tag alt">${state.cards.length?Math.round(learned/state.cards.length*100):0}%</span></div>
      <div class="progress-group"><div class="progress-track"><div class="progress-fill" style="width:${state.cards.length?learned/state.cards.length*100:0}%"></div></div></div></div>
    <div class="section-row"><h2 class="section-title">Explore by topic</h2></div>
    <div class="category-scroll">${tags.map(t=>`<button class="pill" data-action="open-tag" data-tag="${esc(t)}"># ${esc(t)}</button>`).join('')}
      <button class="pill" data-action="navigate" data-page="browse">View all ${icon('right')}</button></div>
    <div class="word-grid">${spotlight.map(c=>`<button class="word-tile" data-action="card-detail" data-id="${esc(c.id)}"><div><div class="hanzi">${esc(c.hanzi)}</div><div class="pinyin">${esc(c.pinyin)}</div></div><div class="translation">${esc(c.english)}</div></button>`).join('')}</div>`;
}

function availableQueue() {
  const due=state.cards.filter(c=>isDue(c.id)).sort((a,b)=>Date.parse(state.schedules[a.id].dueAt)-Date.parse(state.schedules[b.id].dueAt));
  const newCards=state.cards.filter(c=>!state.schedules[c.id]).slice(0,newRemaining());
  const max=state.settings.sessionSize;
  const dueCap = Math.max(1,Math.floor(max*.7));
  // Mix due reviews and new introductions, while always respecting session size.
  const picked = [...due.slice(0,dueCap),...newCards.slice(0,max-dueCap),...due.slice(dueCap)];
  if (picked.length<max) picked.push(...newCards.slice(Math.max(0,max-dueCap)));
  return [...new Set(picked.map(c=>c.id))].slice(0,max);
}

async function startSession() {
  if (state.activeSession) { page='study'; revealed=false; render(); return; }
  const queue=availableQueue();
  if (!queue.length) {page='home';render();toast('All caught up. Come back when reviews are due.');return;}
  const session = {id:crypto.randomUUID(),startedAt:new Date().toISOString(),queue,initialTotal:queue.length,
    results:[],newWords:0,correct:0};
  if (await change(d=>{d.activeSession=session;})) {page='study';revealed=false;render();}
}

async function gradeCard(grade) {
  if (saving || !revealed || !state.activeSession?.queue.length) return;
  const id=state.activeSession.queue[0];
  const previous=state.schedules[id] || null;
  const now=Date.now();
  const after=scheduleReview(previous,grade,now,state.settings.desiredRetention);
  const newReview = !previous;
  const completed = state.activeSession.queue.length <= 1;
  const done = await change(d=>{
    d.schedules[id]=after;
    const entry={id:crypto.randomUUID(),cardId:id,at:new Date(now).toISOString(),grade,first:newReview,
      previousDueAt:previous?.dueAt||null, nextDueAt:after.dueAt,model:MODEL};
    d.history.push(entry);
    d.activeSession.results.push({cardId:id,grade});
    d.activeSession.queue.shift();
    if (newReview) d.activeSession.newWords++;
    if (grade>=3) d.activeSession.correct++;
    if (completed) {
      const s=d.activeSession;
      lastFinished={id:s.id,startedAt:s.startedAt,endedAt:new Date(now).toISOString(),
        total:s.results.length,newWords:s.newWords,correct:s.correct,results:s.results};
      d.sessions.push(lastFinished);
      d.activeSession=null;
    }
  },false);
  if (done) { revealed=false; page=completed?'complete':'study';render(); }
}

async function finishEarly() {
  if (!state.activeSession) return;
  const s=state.activeSession;
  if (!s.results.length) {
    if (await change(d=>{d.activeSession=null;})) {page='home';render();}
    return;
  }
  const finished={id:s.id,startedAt:s.startedAt,endedAt:new Date().toISOString(),
    total:s.results.length,newWords:s.newWords,correct:s.correct,results:s.results};
  const okay = await change(d=>{d.sessions.push(finished); d.activeSession=null;},false);
  if (okay){lastFinished=finished;page='complete';render();}
}

function renderStudy() {
  const session=state.activeSession;
  if (!session) {
    return `<div class="page-heading"><div class="eyebrow">STUDY MODE</div><h1 class="h1">Time for a little practice?</h1><p class="lead">Tap Start to review due words and meet a few new ones.</p></div>
      <div class="panel stack"><div class="row"><strong>Due for review</strong><span class="tag">${countDue()}</span></div>
      <div class="row"><strong>New words available today</strong><span class="tag">${Math.min(newRemaining(),countNew())}</span></div>
      <button class="btn btn-primary btn-full" data-action="start">${icon('spark')}Start a session</button></div>${backupBanner()}`;
  }
  const id=session.queue[0];
  const card=cardById(id);
  if (!card) return '<div class="empty">This card is missing. Try returning home.</div>';
  const processed=session.results.length;
  const score=state.schedules[id];
  const labels=previewIntervals(score,Date.now(),state.settings.desiredRetention);
  return `<div class="review-top"><button class="icon-btn" aria-label="End session" data-action="finish-prompt">${icon('x')}</button>
       <div class="review-progress" aria-label="Session progress"><span style="width:${100*processed/session.initialTotal}%"></span></div>
       <span class="review-note">${processed+1} / ${session.initialTotal}</span></div>
    <div class="review-card" ${revealed?'':'data-action="reveal" role="button" tabindex="0" aria-label="Reveal answer"'}>
      <div class="card-kicker">${score?'REVIEW WORD':'NEW WORD'} · CHINESE → ENGLISH</div>
      ${card.tags.length?`<span class="review-tag">${fullTag(card.tags[0])}</span>`:''}
      <div class="review-hanzi">${esc(card.hanzi)}</div>
      ${(revealed||state.settings.showPinyinPrompt)&&card.pinyin?`<div class="review-pinyin">${esc(card.pinyin)}</div>`:''}
      ${revealed?`<div class="review-english">${esc(card.english)}</div>
        ${card.example?`<div class="review-example"><div>${esc(card.example)}</div>${card.examplePinyin?`<div class="pinyin">${esc(card.examplePinyin)}</div>`:''}${card.exampleEnglish?`<div class="meaning">${esc(card.exampleEnglish)}</div>`:''}</div>`:''}`:`<div class="review-prompt">Think of the meaning, then tap to reveal</div>`}
    </div>
    ${revealed?`<div class="eyebrow" style="text-align:center">HOW WELL DID YOU REMEMBER?</div>
        <div class="review-controls">${[['again','Again',1],['hard','Hard',2],['good','Good',3],['easy','Easy',4]].map(([cls,label,g],i)=>`<button class="grade ${cls}" data-action="grade" data-grade="${g}"><strong>${label}</strong><span>${labels[i]}</span></button>`).join('')}</div>`:
      `<button class="btn btn-primary btn-full" data-action="reveal">Reveal answer ${icon('right')}</button>`}
    <div class="study-actions"><span class="subtle">${countDue()} due in your deck</span><button class="text-link" data-action="finish-prompt">Finish early</button></div>
    <p class="study-captions">Each answer is saved automatically · Export at session end</p>`;
}

function renderComplete() {
  const s=lastFinished || state.sessions[state.sessions.length-1];
  if (!s) return '<p>No completed session yet.</p>';
  const accuracy=s.total?Math.round(s.correct/s.total*100):0;
  return `<div class="eyebrow" style="text-align:center;margin-top:35px">NICE WORK TODAY</div>
    <div class="complete-art"><span class="big-symbol">好</span></div>
    <h1 class="complete-title">You showed up.<br/>That matters.</h1>
    <p class="complete-subtitle">Every word you practice makes the next conversation a little easier.</p>
    <div class="complete-stats"><div><strong>${s.total}</strong><span>Reviewed</span></div>
      <div><strong>${s.newWords}</strong><span>New words</span></div><div><strong>${accuracy}%</strong><span>Recall</span></div></div>
    <div class="panel stack" style="margin-top:10px"><div class="row"><div>${icon('shield')} <strong style="margin-left:6px">Protect your progress</strong></div><span class="tag alt">Important</span></div>
      <p class="lead" style="font-size:13px">Reviews are saved in the app, but only a JSON backup kept in Files protects them if iPhone clears website storage.</p>
      <button class="btn btn-primary btn-full" data-action="backup">${icon('download')}Save progress to Files</button>
      ${backupNeeded()?'<div class="notice warning">Your latest reviews have not been confirmed as backed up yet.</div>':'<div class="notice">Latest changes marked as backed up.</div>'}
      <button class="text-link" data-action="navigate" data-page="home" style="text-align:center">Back to home</button></div>`;
}

function renderBrowse() {
  return `<div class="page-heading"><div class="eyebrow">YOUR WORD GARDEN</div><div class="headline-row"><div><h1 class="h1">Every word<br/>has a story.</h1><p class="lead">Search, collect and grow your vocabulary.</p></div><button class="icon-btn" data-action="new-card" aria-label="Add card" style="margin-top:12px">${icon('plus')}</button></div></div>
    <label class="search-field">${icon('search')}<input id="word-search" placeholder="Search characters, English, pinyin, tags…" value="${esc(browseQuery)}" autocomplete="off" /></label>
    <div id="tag-filter" class="category-scroll"></div>
    <div class="row" style="margin-bottom:13px"><div id="browse-count" class="filter-count"></div><button class="text-link" data-action="new-card">${icon('plus')} Add word</button></div>
    <div id="word-list"></div>${backupBanner()}`;
}
function updateBrowseList() {
  if (page!=='browse') return;
  const all=allTags();
  $('#tag-filter').innerHTML = [`<button class="pill ${browseTag==='all'?'selected':''}" data-action="set-tag" data-tag="all">All topics</button>`, ...all.map(t=>`<button class="pill ${browseTag===t?'selected':''}" data-action="set-tag" data-tag="${esc(t)}"># ${esc(t)}</button>`)].join('');
  const q=browseQuery.trim().toLowerCase();
  const found=state.cards.filter(c=>{
    if (browseTag!=='all' && !c.tags.includes(browseTag)) return false;
    return !q || [c.hanzi,c.english,c.pinyin,c.example,c.exampleEnglish,...c.tags].join(' ').toLowerCase().includes(q);
  });
  $('#browse-count').textContent = `${found.length} word${found.length===1?'':'s'} ${browseTag!=='all'?`in #${browseTag}`:'in your collection'}`;
  $('#word-list').innerHTML=found.length?found.map(c=>{
    const due=dueLabel(state.schedules[c.id]);
    return `<button class="list-card" data-action="card-detail" data-id="${esc(c.id)}"><div class="list-hanzi">${esc(c.hanzi)}<small>${esc(c.pinyin)}</small></div><div class="list-detail"><strong>${esc(c.english)}</strong><small>${esc(c.tags.slice(0,2).map(x=>'#'+x).join('  '))} · ${esc(due)}</small></div><span class="list-chevron">${icon('right')}</span></button>`;
  }).join(''):`<div class="empty"><div class="emoji">⌕</div><strong>No matching words</strong>Try another search or add a new card.</div>`;
}

function getReviewSeries() {
  return Array.from({length:7},(_,i)=>{
    const d=new Date();d.setDate(d.getDate()-6+i);
    const day=formatDay(d);
    return {day, label:d.toLocaleDateString(undefined,{weekday:'short'}),count:state.history.filter(h=>dateKey(h.at)===day).length};
  });
}
function reviewStreak() {
  const days=new Set(state.history.map(h=>dateKey(h.at)));
  const d=new Date();
  if(!days.has(formatDay(d))) d.setDate(d.getDate()-1);
  let total=0;
  while(days.has(formatDay(d))){total++;d.setDate(d.getDate()-1);}
  return total;
}
function renderStats() {
  const total=state.history.length;
  const good=state.history.filter(h=>h.grade>=3).length;
  const series=getReviewSeries(), max=Math.max(1,...series.map(x=>x.count));
  const studied=countLearned();
  const accuracy=total?Math.round(100*good/total):0;
  return `<div class="page-heading"><div class="eyebrow">THE LONG GAME</div><h1 class="h1">Look how far<br/>you've come.</h1><p class="lead">Progress is a collection of small decisions.</p></div>
    <div class="stat-overview"><div class="stat-block">${icon('book')}<strong>${studied}</strong><span>Words introduced</span></div>
      <div class="stat-block">${icon('refresh')}<strong>${total}</strong><span>Total reviews</span></div>
      <div class="stat-block">${icon('flame')}<strong>${reviewStreak()} days</strong><span>Practice streak</span></div>
      <div class="stat-block">${icon('spark')}<strong>${accuracy}%</strong><span>Good / Easy ratings</span></div></div>
    <div class="section-row"><h2 class="section-title">This week</h2><span class="subtle">${series.reduce((a,v)=>a+v.count,0)} reviews</span></div>
    <div class="panel"><div class="eyebrow">REVIEWS PER DAY</div><div class="week-bars">${series.map(x=>`<div class="bar-column" title="${x.count} reviews"><div class="bar-fill" style="height:${Math.max(5,x.count/max*104)}px"></div><div class="bar-label">${esc(x.label)}</div></div>`).join('')}</div></div>
    <div class="section-row"><h2 class="section-title">Memory health</h2></div>
    <div class="panel"><div class="row"><div><strong>Estimated recall</strong><p class="subtle" style="margin-bottom:0;line-height:1.5">Based on the ${MODEL} memory model for your studied words.</p></div><strong style="font-size:28px">${strength()}%</strong></div>
      <div class="progress-group"><div class="progress-track"><div class="progress-fill" style="width:${strength()}%"></div></div></div></div>
    <div class="section-row"><h2 class="section-title">Recent sessions</h2></div>
    ${state.sessions.length?state.sessions.slice(-5).reverse().map(s=>`<div class="list-card" style="cursor:default"><span class="brand-mark" style="width:40px;height:40px;font-size:20px;background:#e3f2e3;color:var(--forest)">好</span><div class="list-detail"><strong>${new Date(s.endedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</strong><small>${s.total} reviews · ${s.newWords} new · ${s.total?Math.round(100*s.correct/s.total):0}% recall</small></div></div>`).join(''):'<div class="empty">Your first completed session will appear here.</div>'}`;
}
function renderSettings() {
  const s=state.settings;
  return `<div class="page-heading"><div class="eyebrow">MAKE IT YOURS</div><h1 class="h1">Your practice,<br/>your pace.</h1><p class="lead">Adjust your study rhythm and keep your data safe.</p></div>
    <div class="section-row"><h2 class="section-title">Study preferences</h2></div>
    <div class="panel"><div class="settings-row"><div><strong>New words per day</strong><small>0–50 · New cards begin when you study</small></div><input type="number" min="0" max="50" data-setting="dailyNew" value="${s.dailyNew}" aria-label="New words per day" /></div>
      <div class="settings-row"><div><strong>Cards per session</strong><small>1–100 reviews in a session</small></div><input type="number" min="1" max="100" data-setting="sessionSize" value="${s.sessionSize}" aria-label="Cards per session" /></div>
      <div class="settings-row"><div><strong>Target retention</strong><small>Choose how often you aim to remember</small></div><select data-setting="desiredRetention" style="width:110px;border:1px solid #dae6dc;border-radius:12px;padding:9px;background:#fff"><option value="0.85" ${s.desiredRetention===.85?'selected':''}>85%</option><option value="0.9" ${s.desiredRetention===.9?'selected':''}>90%</option><option value="0.95" ${s.desiredRetention===.95?'selected':''}>95%</option></select></div>
      <div class="settings-row"><div><strong>Show pinyin on the front</strong><small>Off by default, to practice reading hanzi</small></div><input class="toggle" type="checkbox" role="switch" data-setting="showPinyinPrompt" ${s.showPinyinPrompt?'checked':''} aria-label="Show pinyin on front" /></div></div>
    <div class="section-row"><h2 class="section-title">Your data</h2><span class="subtle">Stored on this device</span></div>
    <div class="panel stack"><div class="notice ${backupNeeded()?'warning':''}">${backupNeeded()?'You have changes that are not confirmed in a saved backup.':'Your current progress is marked as backed up.'}</div>
      <button class="btn btn-primary btn-full" data-action="backup">${icon('download')}Export progress backup</button>
      <button class="btn btn-secondary btn-full" data-action="restore">${icon('upload')}Restore full backup</button>
      <button class="btn btn-secondary btn-full" data-action="import-deck">${icon('plus')}Import word deck (JSON)</button>
      <button class="btn btn-secondary btn-full" data-action="template">${icon('archive')}Download deck template</button>
      <div class="subtle" style="line-height:1.6">The app saves every answer in IndexedDB, which iOS can remove. Export to Files after each study session. Full backup files contain your vocabulary, schedules, settings, and review history.</div>
      <div class="subtle">Last confirmed backup: ${state.lastBackupAt?new Date(state.lastBackupAt).toLocaleString():'Never'}</div></div>
    <div class="section-row"><h2 class="section-title">About Cíyán</h2></div>
    <div class="panel"><p class="lead" style="font-size:13px">Offline-first Mandarin practice. Uses ${MODEL} scheduling, with 1- and 10-minute learning steps. Built without accounts, tracking, cloud sync, or external dependencies.</p>
      <p class="subtle" style="line-height:1.6;margin-bottom:0">Install from Safari → Share → Add to Home Screen → Open as Web App. Keep backups in Files or iCloud Drive. Deleting the app or clearing its website data may remove local progress.</p></div>`;
}
function render() {
  if (!state) return;
  const pages={home:renderHome,study:renderStudy,complete:renderComplete,browse:renderBrowse,stats:renderStats,settings:renderSettings};
  app.innerHTML=shell((pages[page]||renderHome)());
  if (page==='browse') updateBrowseList();
}
function navigate(to) {
  if (!['home','study','browse','stats','settings','complete'].includes(to)) return;
  page=to; revealed=false;
  render(); window.scrollTo({top:0,behavior:'instant'});
}

function modal(title, content) {
  closeModal();
  currentModal=document.createElement('div');
  currentModal.className='modal-backdrop';
  currentModal.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon('x')}</button></div><div class="modal-scroll">${content}</div></div>`;
  document.body.append(currentModal);
  const focus=currentModal.querySelector('input:not([type=file]),button');
  focus?.focus();
}
function closeModal(){if(currentModal){currentModal.remove();currentModal=null;}}
function detailCard(id) {
  const c=cardById(id); if(!c)return;
  const schedule=state.schedules[id];
  modal('Word details',`<div style="text-align:center;padding:2px 0 22px"><div class="review-hanzi" style="margin-bottom:4px">${esc(c.hanzi)}</div><div class="review-pinyin">${esc(c.pinyin)}</div><div class="review-english">${esc(c.english)}</div></div>
    ${c.example?`<div class="panel" style="margin-bottom:15px"><div class="eyebrow">IN CONTEXT</div><div style="font-size:20px;margin:13px 0 5px">${esc(c.example)}</div><div class="subtle">${esc(c.examplePinyin)}</div><p class="lead" style="font-size:13px;margin-top:10px">${esc(c.exampleEnglish)}</p></div>`:''}
    <div class="row" style="flex-wrap:wrap;justify-content:flex-start;margin:0 0 17px">${c.tags.map(fullTag).join('')||'<span class="subtle">No tags</span>'}</div>
    <div class="notice" style="margin-bottom:16px">${schedule?`Reviewed ${schedule.reps} time(s) · ${dueLabel(schedule)} · Stability ${schedule.stability.toFixed(1)} days`:'New · Not yet reviewed'}</div>
    <div class="row"><button class="btn btn-secondary" data-action="edit-card" data-id="${esc(id)}">${icon('edit')}Edit</button><button class="btn btn-danger" data-action="delete-card" data-id="${esc(id)}">${icon('trash')}Delete</button></div>`);
}
function editor(id=null) {
  const c=id?cardById(id):{hanzi:'',pinyin:'',english:'',example:'',examplePinyin:'',exampleEnglish:'',tags:[]};
  if(!c)return;
  modal(id?'Edit word':'Add a word',`<form id="card-form" data-id="${id?esc(id):''}">
    <div class="form-grid"><div class="form-field"><label for="hanzi">Chinese characters *</label><input id="hanzi" name="hanzi" required maxlength="120" value="${esc(c.hanzi)}" /></div><div class="form-field"><label for="pinyin">Pinyin</label><input id="pinyin" name="pinyin" maxlength="160" value="${esc(c.pinyin)}" /></div></div>
    <div class="form-field"><label for="english">English meaning *</label><input id="english" name="english" required maxlength="500" value="${esc(c.english)}" /></div>
    <div class="form-field"><label for="example">Example in Chinese</label><textarea id="example" name="example" maxlength="400">${esc(c.example)}</textarea></div>
    <div class="form-field"><label for="examplePinyin">Example pinyin</label><textarea id="examplePinyin" name="examplePinyin" maxlength="600">${esc(c.examplePinyin)}</textarea></div>
    <div class="form-field"><label for="exampleEnglish">Example translation</label><textarea id="exampleEnglish" name="exampleEnglish" maxlength="600">${esc(c.exampleEnglish)}</textarea></div>
    <div class="form-field"><label for="tags">Tags</label><input id="tags" name="tags" value="${esc(c.tags.join(', '))}" placeholder="food, social, work" /><span class="help">Separate tags with commas. Use them to filter and search.</span></div>
    <button class="btn btn-primary btn-full" type="submit">${icon('check')}${id?'Save changes':'Create word card'}</button></form>`);
}
async function saveEditor(form) {
  const id=form.dataset.id || null;
  const existing=id?cardById(id):null;
  const formData=new FormData(form);
  let card;
  try{card=normalizeCard({...existing,...Object.fromEntries(formData),id:id||undefined,source:existing?.source||'My cards'});}catch(e){toast(e.message);return;}
  const okay=await change(d=>{
    if (id) {const i=d.cards.findIndex(c=>c.id===id);if(i<0)throw new Error('Card no longer exists');d.cards[i]=card;}
    else d.cards.push(card);
  });
  if (okay){closeModal();toast(id?'Word updated':'Word added to your collection');}
}
async function deleteCard(id) {
  const c=cardById(id); if(!c)return;
  if(!window.confirm(`Delete “${c.hanzi}” and its scheduling history? This cannot be undone unless you restore a backup.`))return;
  const done=await change(d=>{
    d.cards=d.cards.filter(c=>c.id!==id);
    delete d.schedules[id];
    d.history=d.history.filter(h=>h.cardId!==id);
    if(d.activeSession) {d.activeSession.queue=d.activeSession.queue.filter(x=>x!==id); if(!d.activeSession.queue.length)d.activeSession=null;}
  });
  if(done){closeModal();toast('Card removed');}
}

function backupModal() {
  pendingBackupRevision=null;
  modal('Protect your progress',`<p class="lead" style="font-size:14px;margin-bottom:18px">Create a complete JSON backup, then save it to your iPhone's Files app (or iCloud Drive). Your progress is never uploaded to us.</p>
    <div class="notice warning" style="margin-bottom:15px">A share/download action does not prove the file was saved. After saving it in Files, confirm below.</div>
    <div class="stack"><button class="btn btn-primary btn-full" data-action="share-backup">${icon('upload')}Save to Files (share sheet)</button>
      <button class="btn btn-secondary btn-full" data-action="download-backup">${icon('download')}Download JSON instead</button>
      <div id="backup-confirm-area"></div>
      <p class="subtle" style="line-height:1.6">Tip: On iPhone, choose <strong>Save to Files</strong> in the share sheet. If using Download instead, locate the JSON in Files → Downloads and keep it somewhere safe.</p></div>`);
}
function downloadFile(file, filename) {
  const url=URL.createObjectURL(file);
  const a=document.createElement('a');a.href=url;a.download=filename;a.style.display='none';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function backupFile() {
  const data=makeBackup(state);
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const fname=`ciyan-progress-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  return new File([blob],fname,{type:'application/json'});
}
async function exportBackup(mode) {
  const file=backupFile();
  const snapshot=state.revision;
  try {
    if(mode==='share' && navigator.share && navigator.canShare?.({files:[file]})){
      await navigator.share({files:[file],title:'Cíyán progress backup'});
    } else { downloadFile(file,file.name); if(mode==='share')toast('Share to Files unavailable; JSON download started'); }
    pendingBackupRevision=snapshot;
    const area=$('#backup-confirm-area');
    if(area) area.innerHTML=`<div class="notice" style="margin-top:8px">Backup file prepared: <strong>${esc(file.name)}</strong></div>
      <button style="margin-top:10px" class="btn btn-soft btn-full" data-action="confirm-backup">${icon('check')}I saved this file in Files</button>`;
  } catch(e) { if(e.name!=='AbortError')toast(`Backup action failed: ${e.message}`); }
}
async function confirmBackup() {
  if(pendingBackupRevision===null)return;
  // This writes only backup metadata; it must not increment the review revision.
  const candidate=structuredClone(state);
  candidate.backedUpRevision=Math.max(candidate.backedUpRevision, Math.min(candidate.revision,pendingBackupRevision));
  candidate.lastBackupAt=new Date().toISOString();
  try {await saveState(candidate);state=candidate;pendingBackupRevision=null;closeModal();render();toast('Backup confirmed. Keep the JSON file safe.');}
  catch(e){toast('Backup status could not be saved: '+e.message);}
}
async function readJsonFile(file) {
  if(!file) return null;
  if(file.size > 25*1024*1024) throw new Error('File exceeds the 25 MB limit');
  try{return JSON.parse(await file.text());}catch {throw new Error('This file is not valid JSON');}
}
function requestFile(kind) {
  const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.className='fileinput';
  document.body.append(file);
  file.addEventListener('change', async()=>{
    try{const content=await readJsonFile(file.files?.[0]);if(content){if(kind==='restore')await restoreBackup(content);else await importDeck(content);}}
    catch(e){toast(e.message);}
    finally{file.remove();}
  },{once:true});
  file.click();
}
async function restoreBackup(content) {
  const parsed=parseBackup(content);
  if(!window.confirm(`Replace all current cards, schedules and history with this backup (${parsed.cards.length} cards, ${parsed.history.length} reviews)? Export current progress first if you want to keep it.`))return;
  try{await saveState(parsed);state=parsed;lastFinished=null;page='home';closeModal();render();toast('Full backup restored successfully');}
  catch(e){toast('Restore failed: '+e.message);}
}
async function importDeck(content) {
  const sources=Array.isArray(content)?content:(Array.isArray(content?.cards)?content.cards:null);
  if(!sources) throw new Error('Expected a JSON array of cards or an object with a cards array');
  if(sources.length>10000) throw new Error('Too many cards in deck');
  const normalized=sources.map(c=>normalizeCard(c));
  const known=new Set(state.cards.map(c=>c.id));
  const unique=new Map();
  normalized.forEach(c=>{if(!known.has(c.id))unique.set(c.id,c);});
  const additions=[...unique.values()];
  if(!additions.length){toast('No new card IDs found; existing cards were not replaced');return;}
  if (!window.confirm(`Add ${additions.length} new cards? Existing cards and reviews will stay unchanged.`))return;
  const done=await change(d=>{d.cards.push(...additions);});
  if(done){closeModal();toast(`${additions.length} new cards imported`);}
}
function downloadTemplate() {
  const demo={format:'ciyan-deck',version:1,cards:[{
    id:'my-deck-sample-001',hanzi:'咖啡',pinyin:'kāfēi',english:'Coffee',
    example:'我想喝咖啡。',examplePinyin:'Wǒ xiǎng hē kāfēi.',exampleEnglish:'I want to drink coffee.',tags:['food','daily-life'],source:'My deck'
  }]};
  const file=new Blob([JSON.stringify(demo,null,2)],{type:'application/json'});
  downloadFile(file,'ciyan-deck-template.json');
  toast('Deck template prepared');
}
function finishPrompt() {
  modal('Finish this session?',`<p class="lead" style="font-size:14px;margin-bottom:20px">Your answered cards are already saved locally. You can finish early and back up what you've practiced, or continue.</p>
    <div class="stack"><button class="btn btn-primary btn-full" data-action="end-session">Finish and see summary</button>
      <button class="btn btn-secondary btn-full" data-action="close-modal">Continue studying</button></div>`);
}

// Central delegated event handling, with one-click actions for touch and keyboard.
document.addEventListener('click', async event=>{
  if(currentModal && event.target===currentModal){closeModal();return;}
  const element=event.target.closest('[data-action]'); if(!element)return;
  const action=element.dataset.action;
  switch(action){
    case 'navigate':closeModal();navigate(element.dataset.page);break;
    case 'start':await startSession();break;
    case 'reveal':revealed=true;render();break;
    case 'grade':await gradeCard(Number(element.dataset.grade));break;
    case 'finish-prompt':finishPrompt();break;
    case 'end-session':closeModal();await finishEarly();break;
    case 'open-tag':browseTag=element.dataset.tag;browseQuery='';navigate('browse');break;
    case 'set-tag':browseTag=element.dataset.tag;updateBrowseList();break;
    case 'card-detail':detailCard(element.dataset.id);break;
    case 'new-card':editor();break;
    case 'edit-card':editor(element.dataset.id);break;
    case 'delete-card':await deleteCard(element.dataset.id);break;
    case 'backup':backupModal();break;
    case 'close-modal':closeModal();break;
    case 'share-backup':await exportBackup('share');break;
    case 'download-backup':await exportBackup('download');break;
    case 'confirm-backup':await confirmBackup();break;
    case 'restore':requestFile('restore');break;
    case 'import-deck':requestFile('deck');break;
    case 'template':downloadTemplate();break;
  }
});
document.addEventListener('submit',async event=>{
  if(event.target.matches('#card-form')){event.preventDefault();await saveEditor(event.target);}
});
document.addEventListener('input',event=>{
  if(event.target.id==='word-search'){browseQuery=event.target.value;updateBrowseList();}
});
document.addEventListener('change',async event=>{
  const key=event.target.dataset.setting;
  if(!key)return;
  const target=event.target;
  let value=target.type==='checkbox'?target.checked:Number(target.value);
  if(key==='dailyNew') value=Math.max(0,Math.min(50,Math.round(value||0)));
  if(key==='sessionSize') value=Math.max(1,Math.min(100,Math.round(value||12)));
  if(key==='desiredRetention') value=[.85,.9,.95].includes(value)?value:.9;
  await change(d=>{d.settings[key]=value;});
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&currentModal){closeModal();return;}
  if((event.key==='Enter'||event.key===' ')&&!revealed&&page==='study'&&event.target.closest('.review-card')){
    event.preventDefault();revealed=true;render();
  }
  if(page==='study'&&revealed&&!currentModal&&['1','2','3','4'].includes(event.key))gradeCard(Number(event.key));
});

async function boot() {
  try {
    state = await loadState();
    if(!state){state=defaultState();await saveState(state);}
    // Fill in newly-added settings fields without destroying existing cards or history.
    state.settings={...defaultState().settings,...state.settings};
    state.revision=Number(state.revision)||0;
    state.backedUpRevision=Number(state.backedUpRevision)||0;
    if(!Array.isArray(state.cards)||!Array.isArray(state.history)||!state.schedules)throw new Error('Stored data has an unexpected format. Restore from a backup.');
    render();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }
    if(navigator.storage?.persist) navigator.storage.persist().catch(()=>{});
  } catch(e) {
    app.innerHTML=`<div class="loading-state" style="text-align:center;padding:25px"><div class="brand-mark">!</div>
       <h2>Local storage unavailable</h2><p>${esc(e.message)}</p><p>Open the app in Safari or its installed Home Screen version, not a private tab or a file preview. Your progress has not been reset.</p>
       <button class="btn btn-secondary" onclick="location.reload()">Try again</button></div>`;
  }
}
boot();
