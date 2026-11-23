import {PANLONG_V099_EDITORIAL_UPDATES} from './master-v099-editorial.js';
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
 if(e&&(['words','drawing'].includes(e.mode)?!ids.has(e.id):['grammar','listening'].includes(e.mode)?!gids.has(e.id):false))state.activePractice=null;
 // Keep schedules of absent custom items so manually reloading their master can
 // recover progress. They are excluded from the active collection's due chart.
 return state;
}

// v0.6.6: Add new bundled content without deleting or replacing any entry
// already present in a restored/custom local master. IDs, tags, synonyms,
// learning records and edited definitions remain authoritative locally.
// Unlike replaceMaster(), this is safe to call during every app startup.
export function reconcileBundledMaster(state,source){
 if(!state||!Array.isArray(state.cards)||!Array.isArray(state.grammar)||!source?.cards||!source?.grammar)throw new Error('Cannot reconcile an invalid master collection.');
 const cardsByHanzi=new Map(state.cards.map(c=>[c.hanzi,c]));
 const usedCardIds=new Set(state.cards.map(c=>c.id));
 const grammarByMarkup=new Map(state.grammar.map(g=>[g.markup,g]));
 const usedGrammarIds=new Set(state.grammar.map(g=>g.id));
 const incomingCards=[],incomingGrammar=[];
 const safeId=(base,ids)=>{let id=base,n=1;while(ids.has(id)){id=`${base}-bundled-${n++}`;}ids.add(id);return id;};
 for(const original of source.cards){
  if(cardsByHanzi.has(original.hanzi))continue;
  const card=normalizeCard({...original,id:safeId(original.id,usedCardIds)});
  cardsByHanzi.set(card.hanzi,card);incomingCards.push(card);
 }
 for(const original of source.grammar){
  if(grammarByMarkup.has(original.markup))continue;
  const entry=normalizeGrammar({...original,id:safeId(original.id,usedGrammarIds)});
  grammarByMarkup.set(entry.markup,entry);incomingGrammar.push(entry);
 }
 // Imported words may receive a fresh ID when a user-created card already
 // owns the bundled one. Their synonym targets must follow local identities.
 const sourceWordsById=new Map(source.cards.map(card=>[card.id,card.hanzi]));
 for(const card of incomingCards){
  const resolved=new Map();
  for(const edge of card.synonyms||[]){
   const word=sourceWordsById.get(edge.id);
   const target=cardsByHanzi.get(word);
   if(target&&target.id!==card.id&&!resolved.has(target.id))resolved.set(target.id,edge.similarity);
  }
  if(card.synonyms)card.synonyms=[...resolved].map(([id,similarity])=>({id,similarity}));
 }
 if(incomingCards.length)state.cards=[...state.cards,...incomingCards];
 if(incomingGrammar.length)state.grammar=[...state.grammar,...incomingGrammar];
 if(state.cards.length>20000||state.grammar.length>20000)throw new Error('Reconciled master is too large; restore an earlier backup.');
 return {changed:!!(incomingCards.length||incomingGrammar.length),addedCards:incomingCards.length,addedGrammar:incomingGrammar.length};
}

// Versioned classification refresh. Keep local card IDs, definitions, synonyms,
// review history and every non-HSK/TSK category. Only the globally defined HSK
// and TSK tier assignments are authoritative; an imported reader tag is not lost.
export function syncBundledClassification(state,source){
 const sourceByHanzi=new Map(source.cards.map(c=>[c.hanzi,c]));
 let updated=0;
 state.cards=state.cards.map(card=>{
  const bundled=sourceByHanzi.get(card.hanzi);
  const classification=bundled?.tags?.filter(t=>t.startsWith('HSK/')||/^TSK\/TSK(?:0?[1-9]|1[0-2])$/.test(t))||[];
  const local=card.tags.filter(t=>!t.startsWith('HSK/')&&!/^TSK\/TSK(?:0?[1-9]|1[0-2])$/.test(t));
  // For genuinely custom cards, the official HSK classification still applies.
  if(!bundled){
   const normalized=normalizeCard(card);
   for(const tag of normalized.tags.filter(t=>t.startsWith('HSK/')))classification.push(tag);
   // Preserve user-defined noncanonical TSK paths.
  }
  const next=[...new Set([...local,...classification])];
  if(next.length===card.tags.length&&next.every((tag,i)=>tag===card.tags[i]))return card;
  updated++;
  return {...card,tags:next};
 });
 return updated;
}

// v0.9.9: enrich an older local bundled collection without replacing user
// cards, stable IDs, scores, schedules, tags or manually edited definitions.
// Called only during an implicit bundled-master update, not for imported
// explicit dictionaries. Repeated calls are idempotent.
export function reconcileBundledEditorial(state,source){
 const byHanzi=new Map(state.cards.map(card=>[card.hanzi,card]));
 const sourceByHanzi=new Map(source.cards.map(card=>[card.hanzi,card]));
 const sourceIdToHanzi=new Map(source.cards.map(card=>[card.id,card.hanzi]));
 let fields=0,tags=0,links=0;
 const visitedPairs=new Set();
 for(const correction of PANLONG_V099_EDITORIAL_UPDATES){
  const card=byHanzi.get(correction.hanzi);
  if(card?.[correction.field]===correction.previous){
   card[correction.field]=correction.next;fields++;
  }
 }
 // Only additive editorial/reader classification; do not replace a custom
 // tag list or overwrite existing synonym scores for that user.
 for(const [hanzi,bundled] of sourceByHanzi){
  const local=byHanzi.get(hanzi);if(!local)continue;
  const extras=(bundled.tags||[]).filter(tag=>
   tag.startsWith('Reader/盘龙/')||tag.startsWith('Source/Reader-')||
   tag.startsWith('Topic/')||tag.startsWith('Register/'));
  const seen=new Set(local.tags||[]);
  for(const tag of extras)if(!seen.has(tag)){local.tags??=[];local.tags.push(tag);seen.add(tag);tags++;}
  // Visit each undirected relationship once. Preserve user-set similarity
  // scores, and when only one direction exists mirror that existing score.
  for(const edge of bundled.synonyms||[]){
   const otherWord=sourceIdToHanzi.get(edge.id);
   const other=byHanzi.get(otherWord);
   if(!other||other.id===local.id)continue;
   const pair=[hanzi,otherWord].sort().join('\u0000');
   if(visitedPairs.has(pair))continue;
   visitedPairs.add(pair);
   const direct=(local.synonyms||[]).find(link=>link.id===other.id);
   const reverse=(other.synonyms||[]).find(link=>link.id===local.id);
   if(!direct){
    local.synonyms??=[];
    local.synonyms.push({id:other.id,similarity:reverse?.similarity??edge.similarity});
    links++;
   }
   if(!reverse){
    other.synonyms??=[];
    other.synonyms.push({id:local.id,similarity:direct?.similarity??edge.similarity});
    links++;
   }
  }
 }
 return {changed:!!(fields||tags||links),fields,tags,links};
}
