import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';
import {FONT_LEVELS,FONT_CATALOG,requiredFonts,fontChoices,fontFace,verifyFontSelection,clearFontProbeCache,mixIndex,applyFontToRoot,normalizeFontSettings} from '../fonts.js';
import {reconcileBundledMaster} from '../master.js';
import {MASTER} from '../master-data.js';
import {defaultState,parseBackup,makeBackup} from '../storage.js';

test('v0.6.6 version migration is identity-safe and all 3444 bundled grammar examples remain',()=>{
 assert.equal(APP_VERSION,'0.8.1');assert.equal(MASTER.cards.length,11893);assert.equal(MASTER.grammar.length,3444);
 const old={format:'ciyan-backup',version:2,appVersion:'0.6.5',state:{appVersion:'0.6.5',schemaVersion:2,foo:11}};
 const next=prepareVersionedBackup(old);
 assert.equal(next.appVersion,'0.8.1');assert.deepEqual(next.state,old.state);
});

test('reconciliation is additive and preserves custom/edited words, grammar and learning data',()=>{
 const s=defaultState();
 const savedWord=s.cards[0];savedWord.english='A custom definition that must survive upgrades';
 s.schedules[savedWord.id]={score:1.97,dueAt:'2026-12-01T03:00:00Z'};
 s.history=[{cardId:savedWord.id,grade:3,at:'2026-11-18T00:00:00Z'}];
 const customCard={id:'special-voice',hanzi:'奇妙甲乙',pinyin:'qí miào jiǎ yǐ',english:'reader term',tags:['Reader/Test']};
 const customGrammar={id:'special-sentence',markup:'{奇妙甲乙}。',pinyin:'Qí miào jiǎ yǐ.',english:'A reader-specific term.',distractors:[]};
 s.cards.push(customCard);s.grammar.push(customGrammar);
 const oldRefs={word:s.cards[0],customCard,customGrammar,history:s.history};
 const first=reconcileBundledMaster(s,MASTER);
 assert.equal(first.changed,true);
 assert.equal(s.cards.find(c=>c.id===savedWord.id).english,'A custom definition that must survive upgrades');
 assert.strictEqual(s.cards.find(c=>c.id===customCard.id),oldRefs.customCard);
 assert.strictEqual(s.grammar.find(g=>g.id===customGrammar.id),oldRefs.customGrammar);
 assert.deepEqual(s.schedules[savedWord.id],{score:1.97,dueAt:'2026-12-01T03:00:00Z'});
 assert.strictEqual(s.history,oldRefs.history);
 assert.ok(s.cards.length>=11894);assert.ok(s.grammar.length>=3445);
 const before=[s.cards,s.grammar,s.cards.length,s.grammar.length];
 const second=reconcileBundledMaster(s,MASTER);
 assert.deepEqual(second,{changed:false,addedCards:0,addedGrammar:0});
 assert.strictEqual(s.cards,before[0]);assert.strictEqual(s.grammar,before[1]);
 const persisted=parseBackup(makeBackup(s));
 assert.equal(persisted.cards.length,before[2]);assert.equal(persisted.grammar.length,before[3]);
 assert.equal(persisted.cards.find(c=>c.id===savedWord.id).english,savedWord.english);
});

test('colliding IDs cannot erase an older custom sentence on reconciling',()=>{
 const s=defaultState(),first=MASTER.grammar[300];
 s.grammar.push({id:first.id,markup:'{你好}。',pinyin:'Nǐ hǎo.',english:'Custom use of an existing ID.',distractors:[]});
 const result=reconcileBundledMaster(s,MASTER);
 assert.ok(result.addedGrammar>0);
 assert.equal(s.grammar.find(x=>x.id===first.id).english,'Custom use of an existing ID.');
 assert.ok(s.grammar.some(x=>x.markup===first.markup&&x.id!==first.id));
});

test('fonts retain level group labels, but selections may span every group',()=>{
 assert.deepEqual(Object.keys(FONT_LEVELS),['beginner','intermediate','advanced','expert']);
 assert.equal(fontChoices('beginner').length,1);
 for(const level of ['intermediate','advanced','expert']){
  const choices=fontChoices(level);assert.equal(choices.length,2);
  for(const [id] of choices)assert.ok(FONT_CATALOG[id]?.aliases.length>=2);
 }
 assert.equal(fontFace('zhushi'),'CiyanZhuShi');
 assert.deepEqual(requiredFonts({enabledFonts:['print','mashan','xiaowei']}),['mashan','xiaowei']);
 assert.deepEqual(requiredFonts({enabledFonts:[]}),[]);
 assert.deepEqual(normalizeFontSettings({fontDifficulty:'advanced',fontChoice:'pen'}),{enabledFonts:['zhushi']});
});

test('missing custom font rejects full selection, print-only and empty sets work',async()=>{
 clearFontProbeCache();
 let result=await verifyFontSelection({enabledFonts:['zhushi','print']},{document:{fonts:{}}});
 assert.equal(result.ok,false);assert.deepEqual(result.missing,['zhushi']);
 result=await verifyFontSelection({enabledFonts:['muyao','zhimang']},{document:{fonts:{}}});
 assert.equal(result.ok,false);assert.deepEqual(result.missing,['muyao','zhimang']);
 for(const enabledFonts of [[],['print']]){
  result=await verifyFontSelection({enabledFonts},{document:{fonts:{}}});assert.equal(result.ok,true);
 }
 clearFontProbeCache();
});

test('rendering with a single font needs no per-character spans',()=>{
 const root={style:{values:{},setProperty(k,v){this.values[k]=v;}},dataset:{},innerHTML:'<strong>欢迎来到中国</strong>'};
 const original=root.innerHTML;
 applyFontToRoot(root,{enabledFonts:['zhushi']});
 assert.equal(root.innerHTML,original);
 assert.equal(root.style.values['--ciyan-zh-font'],'"CiyanZhuShi"');
 assert.equal(root.dataset.fontSelection,'zhushi');
});
