import {initialCards} from './cards.js';
export const DB_NAME = 'ciyan-mandarin';
const DB_VERSION = 1;
const STORE = 'state';
let databasePromise;

function database() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('IndexedDB is not supported in this browser.'));
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Cannot open local database'));
    request.onblocked = () => reject(new Error('Local database is blocked by another tab'));
  });
  return databasePromise;
}

export function defaultState() {
  return {
    schemaVersion: 1,
    cards: initialCards(), schedules: {}, history: [], sessions: [], activeSession: null,
    settings: { dailyNew: 8, sessionSize: 12, desiredRetention: 0.90, showPinyinPrompt: false },
    revision: 0, backedUpRevision: 0, lastBackupAt: null, createdAt: new Date().toISOString()
  };
}

export async function loadState() {
  const db = await database();
  return new Promise((resolve,reject) => {
    const request = db.transaction(STORE,'readonly').objectStore(STORE).get('main');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Cannot read saved data'));
  });
}

export async function saveState(state) {
  const db = await database();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(state,'main');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Cannot save progress'));
    tx.onabort = () => reject(tx.error || new Error('Save was interrupted'));
  });
}

export function normalizeCard(source, fallbackId = null) {
  if (!source || typeof source !== 'object') throw new Error('Invalid card');
  const hanzi = String(source.hanzi || '').trim().slice(0,120);
  const english = String(source.english || '').trim().slice(0,500);
  if (!hanzi || !english) throw new Error('Each card needs hanzi and english');
  const string = (x,max) => String(x || '').trim().slice(0,max);
  const tags = Array.isArray(source.tags) ? source.tags : String(source.tags||'').split(',');
  const cleanedTags = [...new Set(tags.map(t => String(t).trim().toLowerCase().slice(0,36)).filter(Boolean))].slice(0,12);
  return {
    id: string(source.id || fallbackId || crypto.randomUUID(), 120),
    hanzi, english, pinyin: string(source.pinyin,160),
    example: string(source.example,400), examplePinyin: string(source.examplePinyin,600),
    exampleEnglish: string(source.exampleEnglish,600), tags: cleanedTags,
    source: string(source.source || 'My cards',80),
    createdAt: string(source.createdAt || new Date().toISOString(),80)
  };
}

// Validate data prior to replacing local progress; never trust imported files.
export function parseBackup(data) {
  if (!data || typeof data !== 'object' || data.format !== 'ciyan-backup' || data.version !== 1 || !data.state) {
    throw new Error('Not a valid Cíyán backup (version 1).');
  }
  const source = data.state;
  if (!Array.isArray(source.cards) || !Array.isArray(source.history) || !Array.isArray(source.sessions)) {
    throw new Error('Backup is missing required data.');
  }
  if (source.cards.length > 10000 || source.history.length > 500000 || source.sessions.length > 50000) {
    throw new Error('Backup is too large for this version.');
  }
  const ids = new Set();
  const cards = source.cards.map(c => {
    const card = normalizeCard(c);
    if (ids.has(card.id)) throw new Error('Backup has duplicate card IDs');
    ids.add(card.id); return card;
  });
  const schedules = {};
  for (const [id,s] of Object.entries(source.schedules || {})) {
    if (!ids.has(id) || !s || typeof s !== 'object') continue;
    if (!Number.isFinite(Date.parse(s.dueAt || '')) || !Number.isFinite(Date.parse(s.lastReviewedAt || ''))) continue;
    schedules[id] = {...s, reps: Math.max(0,Number(s.reps)||0), lapses: Math.max(0,Number(s.lapses)||0)};
  }
  const history = source.history.filter(h=>h && ids.has(h.cardId) && [1,2,3,4].includes(h.grade) && Number.isFinite(Date.parse(h.at||'')));
  const sessions = source.sessions.filter(s=>s && Number.isFinite(Date.parse(s.endedAt||''))).slice(-50000);
  const defaults = defaultState();
  const settings = {
    dailyNew: Math.max(0,Math.min(50,Number(source.settings?.dailyNew ?? 8) || 0)),
    sessionSize: Math.max(1,Math.min(100,Number(source.settings?.sessionSize) || 12)),
    desiredRetention: Math.max(.7,Math.min(.97,Number(source.settings?.desiredRetention)||.9)),
    showPinyinPrompt: !!source.settings?.showPinyinPrompt
  };
  const revision = Math.max(0, Math.floor(Number(source.revision)||0));
  const sourceSession = source.activeSession;
  const activeSession = sourceSession && typeof sourceSession === 'object' &&
    Array.isArray(sourceSession.queue) && Array.isArray(sourceSession.results)
    ? {...sourceSession, queue: sourceSession.queue.filter(id=>ids.has(id)),
        results: sourceSession.results.filter(r=>r && ids.has(r.cardId) && [1,2,3,4].includes(r.grade))}
    : null;
  return {...defaults, cards, schedules, history, sessions, settings,
    activeSession: activeSession?.queue?.length ? activeSession : null, revision, backedUpRevision: revision,
    lastBackupAt: new Date().toISOString(), createdAt: source.createdAt || defaults.createdAt};
}

export function makeBackup(state) {
  return {format:'ciyan-backup', version:1, exportedAt:new Date().toISOString(),
    state: {...state, activeSession: state.activeSession, backedUpRevision: state.revision,
      lastBackupAt: new Date().toISOString()}};
}
