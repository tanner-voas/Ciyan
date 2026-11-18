// Keep any entry referenced by vocabulary, drawing, or grammar evidence.
function recorded(s){
 const words=new Set(Object.keys(s.schedules)),sentences=new Set(Object.keys(s.skillSchedules.grammar));
 for(const key of Object.keys(s.skillSchedules.drawing))words.add(key);
 for(const r of s.history)words.add(r.cardId);
 for(const r of s.grammarHistory)sentences.add(r.grammarId);
 for(const r of s.skillHistory){
  if(r.mode==='drawing'||r.mode==='words')words.add(r.id);
  if(r.mode==='grammar')sentences.add(r.id);
 }
 return {words,sentences};
}
function endQueues(s){
 s.activePractice=null;s.activeSession=null;s.activeGrammarSession=null;s.lastPracticeUndo=null;
}
export function clearDictionary(s){
 const {words,sentences}=recorded(s);
 s.cards=s.cards.filter(c=>words.has(c.id));
 s.grammar=s.grammar.filter(c=>sentences.has(c.id));
 s.explicitDictionary=true;endQueues(s);
}
export function reloadCards(s,master,replace){
 const {words,sentences}=recorded(s);
 const oldWords=[...s.cards,...(s.archived?.cards||[])],oldGrammar=[...s.grammar,...(s.archived?.grammar||[])];
 // Resolve returning cards against their historical identity, including archived reader words.
 s.cards=oldWords;s.grammar=oldGrammar;replace(s,master);
 const ids=new Set(s.cards.map(c=>c.id)),gids=new Set(s.grammar.map(c=>c.id));
 s.archived={cards:oldWords.filter(c=>words.has(c.id)&&!ids.has(c.id)),grammar:oldGrammar.filter(c=>sentences.has(c.id)&&!gids.has(c.id))};
 s.explicitDictionary=true;endQueues(s);
}
