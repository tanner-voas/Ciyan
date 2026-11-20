import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MASTER} from '../master-data.js';
import {HSK_LEVELS} from '../hsk-tag-map.js';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';
import {defaultState,canonicalHSKTags,makeBackup,parseBackup,mergeDeck} from '../storage.js';
import {reconcileBundledMaster,syncBundledClassification} from '../master.js';
import {upgradeTskDefaults,TSK_DEFAULTS} from '../tag-weights.js';
import {ensureStudy} from '../study-engine.js';
const levels=JSON.parse(fs.readFileSync(new URL('../content/tsk12-selection.json',import.meta.url),'utf8')).levels;
const hsk=(c)=>c.tags.some(t=>t.startsWith('HSK/'));
const tag=(i)=>`TSK/TSK${String(i).padStart(2,'0')}`;

test('v0.8.10 supplies exactly twelve exclusive TSK tiers with 100 HSK and 100 outside HSK per tier',()=>{
 assert.equal(APP_VERSION,'0.8.11');
 assert.equal(MASTER.cards.length,12505);
 assert.equal(MASTER.grammar.length,3444);
 const used=new Set();
 for(let i=1;i<=12;i++){
  const key=`TSK${String(i).padStart(2,'0')}`;
  const pool=MASTER.cards.filter(c=>c.tags.includes(tag(i)));
  assert.equal(pool.length,200,key);
  assert.equal(pool.filter(hsk).length,100,`${key}: HSK`);
  assert.equal(pool.filter(c=>!hsk(c)).length,100,`${key}: non-HSK`);
  assert.deepEqual(new Set(pool.filter(hsk).map(c=>c.hanzi)),new Set(levels[key].hsk));
  assert.deepEqual(new Set(pool.filter(c=>!hsk(c)).map(c=>c.hanzi)),new Set(levels[key].non_hsk));
  for(const c of pool){assert.ok(!used.has(c.id),`${c.hanzi} belongs to multiple TSK tiers`);used.add(c.id);}
 }
 assert.equal(used.size,2400);
 assert.ok(MASTER.cards.every(c=>c.tags.filter(t=>t.startsWith('TSK/')).length<=1));
 assert.ok(MASTER.cards.every(c=>!c.tags.some(t=>/^TSK\/TSK[1-9]$/.test(t))));
 assert.equal(MASTER.cards.filter(c=>!hsk(c)).length,2559);
 // This directly guarantees the intended learning milestones, even when some
 // TSK HSK words come from levels beyond the separately selected HSK band.
 for(const [level,extras] of [[8,800],[10,1000],[12,1200]]){
  const lower=MASTER.cards.filter(c=>c.tags.some(t=>/^TSK\/TSK(0[1-9]|1[0-2])$/.test(t))&&Number(c.tags.find(t=>t.startsWith('TSK/')).slice(-2))<=level&&!hsk(c));
  assert.equal(lower.length,extras);
 }
});

test('official 2025 HSK classes and TSK hierarchy are consistent and 1–6 complete',()=>{
 const byWord=new Map(MASTER.cards.map(c=>[c.hanzi,c]));
 assert.equal(byWord.size,MASTER.cards.length);
 for(const c of MASTER.cards){
  const tagged=c.tags.filter(t=>t.startsWith('HSK/'));
  const lvl=HSK_LEVELS[c.hanzi];
  assert.deepEqual(tagged,lvl?[`HSK/${lvl.toUpperCase()}`]:[],c.hanzi);
 }
 for(const [word,level] of Object.entries(HSK_LEVELS))if(level!=='hsk7-9')assert.ok(byWord.has(word),`${word} omitted from official HSK1–6`);
 assert.deepEqual(canonicalHSKTags('饺子',['HSK/HSK2','Food/food']),['Food/food','HSK/HSK1']);
 assert.deepEqual(canonicalHSKTags('面条',['HSK/HSK5','Food/food']),['Food/food']);
 assert.equal(MASTER.hskEdition.includes('2025'),true);
});

test('classification sync replaces old HSK/TSK without changing card identities, other tags or memory',()=>{
 const s=defaultState();
 const known=s.cards[0];
 s.cards[0]={...known,english:'MY CUSTOM DEFINITION',tags:['Reader/盘龙','Everyday/daily','HSK/HSK6','TSK/TSK1']};
 s.schedules[known.id]={score:1.75,dueAt:'2026-12-01T08:00:00.000Z',lastReviewedAt:'2026-11-20T08:00:00.000Z',stability:4,difficulty:5,lastRating:3,reps:1};
 s.history=[{cardId:known.id,at:'2026-11-20T00:00:00.000Z',grade:3}];
 s.settings.tagWeights={'HSK/HSK1':12,'TSK/TSK1':777,'TSK/TSK9':3.5,'Food/food':-2};
 const saved=makeBackup(s);saved.appVersion='0.8.9';saved.state.appVersion='0.8.9';
 assert.equal(prepareVersionedBackup(saved).appVersion,'0.8.11');
 const restored=parseBackup(saved);
 const beforeHistory=structuredClone(restored.history),beforeSchedule=structuredClone(restored.schedules[known.id]);
 reconcileBundledMaster(restored,MASTER);
 assert.equal(syncBundledClassification(restored,MASTER)>0,true);
 upgradeTskDefaults(restored.settings,'0.8.9');ensureStudy(restored);
 const imported=restored.cards.find(c=>c.id===known.id);
 const bundled=MASTER.cards.find(c=>c.hanzi===known.hanzi);
 assert.equal(imported.english,'MY CUSTOM DEFINITION');
 assert.ok(imported.tags.includes('Reader/盘龙'));
 assert.ok(imported.tags.includes('Everyday/daily'));
 assert.deepEqual(imported.tags.filter(t=>t.startsWith('HSK/')),bundled.tags.filter(t=>t.startsWith('HSK/')));
 assert.deepEqual(imported.tags.filter(t=>t.startsWith('TSK/')),bundled.tags.filter(t=>t.startsWith('TSK/')));
 assert.ok(!imported.tags.includes('TSK/TSK1'));
 assert.deepEqual(restored.schedules[known.id],beforeSchedule);
 assert.deepEqual(restored.history,beforeHistory);
 assert.equal(restored.settings.tagWeights['TSK/TSK01'],777);
 assert.equal(restored.settings.tagWeights['TSK/TSK09'],3.5);
 assert.equal(restored.settings.tagWeights['Food/food'],-2);
 assert.ok(!Object.hasOwn(restored.settings.tagWeights,'TSK/TSK1'));
 assert.equal(syncBundledClassification(restored,MASTER),0,'second startup is idempotent');
});

test('fresh TSK preferences expose all twelve weights, and migration preserves personalized legacy weights',()=>{
 assert.deepEqual(Object.keys(TSK_DEFAULTS),Array.from({length:12},(_,i)=>tag(i+1)));
 const s=defaultState();
 reconcileBundledMaster(s,MASTER);syncBundledClassification(s,MASTER);ensureStudy(s);
 for(const [name,value] of Object.entries(TSK_DEFAULTS))assert.equal(s.settings.tagWeights[name],value);
 const opts={tagWeights:{'TSK/TSK1':13,'TSK/TSK4':-2,'TSK/TSK09':99}};
 upgradeTskDefaults(opts,'0.8.9');
 assert.equal(opts.tagWeights['TSK/TSK01'],13);
 assert.equal(opts.tagWeights['TSK/TSK04'],-2);
 assert.equal(opts.tagWeights['TSK/TSK09'],99);
 assert.ok(!Object.hasOwn(opts.tagWeights,'TSK/TSK4'));
});

test('importing old deck snapshots cannot reintroduce unpadded TSK assignments',()=>{
 const s=defaultState();reconcileBundledMaster(s,MASTER);syncBundledClassification(s,MASTER);
 const oldWord={id:'old-id',hanzi:'米饭',pinyin:'mǐ fàn',english:'rice',tags:['Food/food','TSK/TSK5','HSK/HSK4']};
 const merged=mergeDeck(s,{format:'ciyan-deck',version:2,cards:[oldWord]}).draft;
 const c=merged.cards.find(w=>w.hanzi==='米饭'),canonical=MASTER.cards.find(w=>w.hanzi==='米饭');
 assert.deepEqual(c.tags.filter(t=>t.startsWith('TSK/')),canonical.tags.filter(t=>t.startsWith('TSK/')));
 assert.deepEqual(c.tags.filter(t=>t.startsWith('HSK/')),canonical.tags.filter(t=>t.startsWith('HSK/')));
 assert.ok(c.tags.includes('Food/food'));
});
