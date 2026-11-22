// Reproduce the app's unfamiliar-vocabulary and chapter-preparation counts.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {MASTER} from '../master-data.js';import {deriveEdition,learnerIndex} from '../reader-editions.js';import {validateChapter,readerAnalysis,importChapterLexicon} from '../reader-core.js';import {defaultState} from '../storage.js';import catalog from '../chapters/index.js';
const root=new URL('../reader/panlong/',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const baseline=new Set(MASTER.cards.filter(c=>c.tags.some(t=>/^HSK\/HSK[1-6]$|^TSK\/TSK(0[1-9]|1[0-2])$/.test(t))).map(c=>c.hanzi));
assert.equal(baseline.size,6553);assert.deepEqual(baseline,new Set(read('pass46/baseline.json')));
const schedules=Object.fromEntries(MASTER.cards.filter(c=>baseline.has(c.hanzi)).map(c=>[c.id,{score:1.5}]));
const index=learnerIndex({cards:MASTER.cards,schedules,history:[]});const now=Date.now();
const volume=[{vocab:new Set(),terms:new Set(),independent:new Set(),occ:0,total:0},{vocab:new Set(),terms:new Set(),independent:new Set(),occ:0,total:0}];
const prior=read('pass45/corpus.json'),current=read('pass46/corpus.json');const rows=[],lists=[];
function counts(p,slot){
 validateChapter(p);
 // No learner history: no automatic synonym substitutions. The benchmark
 // explicitly scores the HSK6+TSK12 baseline as ready, not the user's history.
 const r=deriveEdition(p,index,.92,{permit:w=>p.extras.includes(w)||baseline.has(w)});
 assert.equal(r.changes.size,0);
 const vocab=[...r.stats.unresolved.keys()].sort(),terms=p.lexicon.terms.map(k=>p.items[k].hanzi).sort();
 const independent=[...r.stats.terms].map(k=>p.items[k].hanzi).sort();
 assert.deepEqual(new Set(vocab),new Set(p.lexicon.vocabulary.map(k=>p.items[k].hanzi).filter(w=>!baseline.has(w))));
 const state=defaultState();state.cards=structuredClone(MASTER.cards);state.schedules={...schedules};
 // Use the real chapter preparation engine as well as the preview counter.
 importChapterLexicon(state,p);
 const c={number:1,all:validateChapter(p),focus:p.focus};
 const a=readerAnalysis(state,{items:p.items,progress:{},chapters:[c]},c,now);
 assert.deepEqual(new Set(a.weak.filter(k=>p.items[k].kind==='vocab').map(k=>p.items[k].hanzi)),new Set(vocab));
 assert.deepEqual(new Set(a.weak.filter(k=>p.items[k].kind==='term').map(k=>p.items[k].hanzi)),new Set(terms));
 if(slot!==undefined){const v=volume[slot];vocab.forEach(w=>v.vocab.add(w));terms.forEach(w=>v.terms.add(w));independent.forEach(w=>v.independent.add(w));v.occ+=r.stats.unknown;v.total+=r.stats.displayed;}
 return {vocab,terms,independent,unknownOccurrences:r.stats.unknown,wordOccurrences:r.stats.displayed,unknownDetail:Object.fromEntries(r.stats.unresolved)};
}
for(const e of catalog.filter(e=>e.novel==='panlong')){
 const n=e.number,original=read('chapters/'+String(n).padStart(3,'0')+'.json');
 const a=(await import('../chapters/graded-v091/'+n+'.js')).default,b=(await import('../chapters/'+e.gradedFile)).default;
 const old=counts({...original,...a},0),next=counts({...original,...b},1);
 assert.deepEqual(old.terms,next.terms);
 rows.push({chapter:n,title:e.title,paragraphs:original.paragraphs.length,revisedParagraphs:prior[n-1].graded.filter((p,i)=>p!==current[n-1].graded[i]).length,v091Vocab:old.vocab.length,v092Vocab:next.vocab.length,deltaVocab:next.vocab.length-old.vocab.length,v091Terms:old.terms.length,v092Terms:next.terms.length,v091PreviewTerms:old.independent.length,v092PreviewTerms:next.independent.length,v091OovOccurrences:old.unknownOccurrences,v092OovOccurrences:next.unknownOccurrences,v091WordOccurrences:old.wordOccurrences,v092WordOccurrences:next.wordOccurrences});
 lists.push({chapter:n,title:e.title,v091:old,v092:next});
}
const totals=volume.map(v=>({distinctVocabulary:v.vocab.size,distinctTerms:v.terms.size,distinctPreviewTerms:v.independent.size,unknownOccurrences:v.occ,wordOccurrences:v.total,vocabulary:[...v.vocab].sort(),terms:[...v.terms].sort()}));
assert.equal(totals[0].distinctVocabulary,693);assert.equal(totals[1].distinctVocabulary,read('pass46/audit-summary.json').reconciled_raw);
assert.equal(totals[0].distinctTerms,198);assert.equal(totals[1].distinctTerms,198);
const report={baseline:baseline.size,assumptions:'Every HSK1–6 or TSK01–12 headword is assigned score 1.5. Other vocabulary and all terms score zero; no history or automatic substitutions. Term preview counts only independent spans; chapter study counts include nested terms.',rows,totals,lists};
fs.writeFileSync(new URL('pass46/app-counts.json',root),JSON.stringify(report)+'\n');
const fields=Object.keys(rows[0]);fs.writeFileSync(new URL('pass46/chapter-counts.csv',root),'\ufeff'+fields.join(',')+'\n'+rows.map(r=>fields.map(k=>'"'+String(r[k]).replaceAll('"','""')+'"').join(',')).join('\n')+'\n');
console.table(rows.map(r=>({ch:r.chapter,before:r.v091Vocab,after:r.v092Vocab,terms:r.v092Terms,previewBefore:r.v091PreviewTerms,previewAfter:r.v092PreviewTerms,edited:r.revisedParagraphs})));console.log(totals.map(({vocabulary,terms,...r})=>r));
