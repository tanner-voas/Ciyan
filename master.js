import {normalizeCard} from './storage.js';
import {normalizeGrammar} from './grammar.js';
export function replaceMaster(state,file){
 const input=file?.format==='ciyan-backup'?file.state:file;
 if(!input||!Array.isArray(input.cards)||!Array.isArray(input.grammar)||!input.cards.length)throw new Error('A master file needs the complete cards and grammar arrays.');
 if(input.cards.length>20000||input.grammar.length>20000)throw new Error('Master collection exceeds 20,000 entries.');
 const words=new Map(state.cards.map(c=>[c.hanzi,c])),sentences=new Map(state.grammar.map(g=>[g.markup,g]));
 const cards=input.cards.map(c=>normalizeCard({...c,id:words.get(c.hanzi)?.id||c.id}));
 const grammar=input.grammar.map(g=>normalizeGrammar({...g,id:sentences.get(g.markup)?.id||g.id}));
 if(new Set(cards.map(c=>c.id)).size!==cards.length||new Set(cards.map(c=>c.hanzi)).size!==cards.length||new Set(grammar.map(g=>g.id)).size!==grammar.length)throw new Error('Duplicate IDs or vocabulary in master collection.');
 const oldById=new Map(state.cards.map(c=>[c.id,c.hanzi]));
 if(cards.some(c=>oldById.has(c.id)&&oldById.get(c.id)!==c.hanzi))throw new Error('A master word ID identifies a different word. Use a new ID for a new word.');
 const oldGrammar=new Map(state.grammar.map(g=>[g.id,g.markup]));
 if(grammar.some(g=>oldGrammar.has(g.id)&&oldGrammar.get(g.id)!==g.markup))throw new Error('A grammar ID identifies a different sentence. Use a new ID for a new sentence.');
 state.cards=cards;state.grammar=grammar;
 const ids=new Set(cards.map(c=>c.id)),gids=new Set(grammar.map(g=>g.id));
 const e=state.activePractice?.current;
 if(e&&(['words','drawing'].includes(e.mode)?!ids.has(e.id):e.mode==='grammar'?!gids.has(e.id):false))state.activePractice=null;
 // Keep schedules of absent custom items so manually reloading their master can
 // recover progress. They are excluded from the active collection's due chart.
 return state;
}
