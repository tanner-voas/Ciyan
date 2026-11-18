import fs from 'node:fs';import {MASTER} from './master-data.js';import {contextIndex} from './context-matching.js';
const index=contextIndex(MASTER.grammar,MASTER.cards);
const COUNTS={exact:0,whole:0,within:0,unmatched:0};
const group=new Map(),rows=[];
const csv=x=>'"'+String(x??'').replaceAll('"','""')+'"';
for(const card of MASTER.cards){
 const matches=index.get(card.hanzi)||[];
 const rule=matches.some(m=>m.rule==='exact')?'exact':matches.some(m=>m.rule==='whole')?'whole':matches.length?'within':'unmatched';COUNTS[rule]++;
 const hsk=card.tags.find(t=>t.startsWith('HSK/'))||'Other';
 const g=group.get(hsk)||{vocabulary:0,exact:0,whole:0,within:0,unmatched:0};g.vocabulary++;g[rule]++;group.set(hsk,g);
 rows.push([card.id,card.hanzi,hsk,rule,matches.length,matches.filter(m=>m.rule==='exact').length,matches.filter(m=>m.rule==='whole').length,matches.filter(m=>m.rule==='within').length,matches[0]?.grammar.id||'',matches[0]?.matchedTokens.map(t=>`{${t}}`).join('')||'']);
}
const report={appVersion:'0.6.2',vocabulary:MASTER.cards.length,grammar:MASTER.grammar.length,covered:MASTER.cards.length-COUNTS.unmatched,coveragePercent:+(100*(1-COUNTS.unmatched/MASTER.cards.length)).toFixed(2),primaryRule:COUNTS,byHSK:Object.fromEntries([...group].sort((a,b)=>a[0].localeCompare(b[0]))) };
fs.writeFileSync('content/context-coverage-summary-v062.json',JSON.stringify(report,null,2)+'\n');
fs.writeFileSync('content/context-coverage-v062.csv',[['id','hanzi','hsk','preferred_rule','matching_sentences','exact_examples','whole_token_examples','within_token_examples','first_grammar_id','example_original_tokens'],...rows].map(row=>row.map(csv).join(',')).join('\n')+'\n');
console.log(JSON.stringify(report,null,2));
