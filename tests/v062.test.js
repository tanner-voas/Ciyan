import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MASTER} from '../master-data.js';
import {matchWordInGrammar,allMatches,contextIndex,contextMatches,contextMatchLabel,contextMatchSource,literalGrammarTokens} from '../context-matching.js';
import {contextsForWord} from '../grammar-context.js';
import {contextFor} from '../study-engine.js';
import {normalizeGrammar,grammarTokens} from '../grammar.js';
import {defaultState,makeBackup,parseBackup} from '../storage.js';
import {replaceMaster} from '../master.js';
import {scheduleReview} from '../review-scheduler.js';
const sample=markup=>({id:'example',markup,pinyin:'',english:'test'});
const card=(hanzi,id=hanzi)=>({id,hanzi,pinyin:'p',english:'test',tags:[]});
function fixture(markups){const cards=['没关系','没','关系','关','系','没关','汉子','子','没有','汉'].map(w=>card(w));return {cards,grammar:markups.map((markup,i)=>({...sample(markup),id:`g${i}`})),schedules:{},settings:{},skillSchedules:{drawing:{}}};}
test('exact-complete / full-token sequence / one-token substring; never a hybrid across token boundaries',()=>{
 const g=sample('{没}{关系}。');
 const checks={'没关系':'whole','没':'exact','关系':'exact','关':'within','系':'within'};
 for(const [word,rule] of Object.entries(checks))assert.equal(matchWordInGrammar(g,word)?.rule,rule,word);
 for(const word of ['没关','没系','关没','系没','关係','没关系啊'])assert.equal(matchWordInGrammar(g,word),null,word);
 assert.equal(matchWordInGrammar(sample('{汉子}。'),'子')?.rule,'within');
 assert.equal(matchWordInGrammar(sample('{没关系}。'),'没关系')?.rule,'exact');
 assert.equal(matchWordInGrammar(sample('{没}{，}{关系}。'),'没关系'),null);
 assert.equal(matchWordInGrammar(sample('{没}，{关系}。'),'没关系'),null);
 assert.equal(matchWordInGrammar(sample('{没}{关系}{啊}。'),'没关系')?.rule,'whole');
});
test('inverted index agrees with direct match for combinations and punctuation boundaries',()=>{
 const s=fixture(['{没}{关系}。','{没关系}。','{汉子}。','{没}，{关系}。']);
 const ix=contextIndex(s.grammar,s.cards);
 assert.deepEqual((ix.get('没关系')||[]).map(m=>[m.grammar.id,m.rule]),[['g0','whole'],['g1','exact']]);
 assert.deepEqual((ix.get('没关')||[]).map(x=>[x.grammar.id,x.rule]),[['g1','within']]);
 assert.equal(contextMatches(s,card('子'))[0].rule,'within');
 assert.equal(contextMatchLabel(contextMatches(s,card('子'))[0]),'Inside one token');
 assert.equal(contextMatchSource(contextMatches(s,card('子'))[0]),'{汉子} contains 子');
 assert.equal(literalGrammarTokens(s.grammar[0]),'{没} {关系}');
});
test('exact examples outrank phrase and substring fallbacks even when other examples exist',()=>{
 const s=fixture(['{没}{关系}。','{没关系}。','{没关系}{他}。']);
 s.grammar[2]=sample('{汉子}。');s.grammar[2].id='g2';
 const lookup=contextMatches(s,card('没关系'));assert.equal(lookup.length,2);
 assert.equal(contextsForWord(s,card('没关系'),()=>0)[0].rule,'exact');
 assert.equal(contextsForWord(s,card('子'),()=>0)[0].rule,'within');
});
test('changes to cloned grammar content rebuild the index; unmodified clones reuse it',()=>{
 const s=fixture(['{没}{关系}。']);const a=contextIndex(s.grammar,s.cards);
 const copy={...s,cards:structuredClone(s.cards),grammar:structuredClone(s.grammar)};
 assert.equal(contextIndex(copy.grammar,copy.cards),a);
 const edited={...copy,grammar:structuredClone(copy.grammar)};edited.grammar[0].markup='{汉子}。';assert.notEqual(contextIndex(edited.grammar,edited.cards),a);
 assert.equal(contextMatches(edited,card('子'))[0].rule,'within');
});
test('drawing can use a strict fallback without leaking other occurrences of target characters',()=>{
 const s=fixture(['{汉子}{没}。','{汉子}{子}。']);s.grammar[0].pinyin='hàn zi méi';s.grammar[1].pinyin='hàn zi zi';
 const m=contextFor(s,card('子'));
 assert.equal(m.grammar.id,'g0');assert.equal(m.rule,'within');
});
test('master preserves all vocabulary IDs, tags and synonyms; prunes only named placeholders',()=>{
 const baseText=fs.readFileSync(new URL('../content/base-master-v055.json',import.meta.url),'utf8');
 const report=JSON.parse(fs.readFileSync(new URL('../content/context-content-report-v062.json',import.meta.url)));
 const pruned=JSON.parse(fs.readFileSync(new URL('../content/pruned-context-ids-v062.json',import.meta.url)));
 assert.equal(report.vocabulary,11893);assert.equal(report.importedV061,805);assert.equal(report.prunedGrammar,25);
 assert.ok(MASTER.grammar.length>=report.grammar);assert.equal(report.grammar,2761);assert.equal(new Set(MASTER.grammar.map(g=>g.id)).size,MASTER.grammar.length);
 for(const id of pruned.ids)assert.ok(!MASTER.grammar.some(g=>g.id===id),id);
 for(const g of MASTER.grammar){normalizeGrammar(g);assert.ok(g.pinyin&&g.english);assert.ok(grammarTokens(g).length<=35);}
});
test('0.6.1 backup upgrades to 0.6.2 without changing card scores or preferences',()=>{
 const s=defaultState();replaceMaster(s,MASTER);s.schedules[s.cards[0].id]={...scheduleReview(null,3,Date.now(),s.settings),score:2.13};
 s.settings.newWordsPerDay=57;const backup=makeBackup(s);backup.appVersion='0.6.1';
 const restored=parseBackup(backup);assert.equal(restored.appVersion,'0.7.5');assert.equal(restored.schedules[s.cards[0].id].score,2.13);assert.equal(restored.settings.newWordsPerDay,57);
});
