// Merge a restored full backup with current and bundled master content.
// Backup wins for learning records; no content is silently deleted.
export function mergeRestoredContent(restored,current,master){
 // Full backup is authoritative for learning history/settings, but not for deleting
 // newer bundled content. Match by headword/markup, preserving learned IDs.
 const wordMap=new Map(restored.cards.map(c=>[c.hanzi,c]));
 const ids=new Set(restored.cards.map(c=>c.id));
 for(const source of [...current.cards,...master.cards]){
  if(wordMap.has(source.hanzi))continue;
  if(ids.has(source.id))throw new Error('Word ID conflict while merging backup');
  wordMap.set(source.hanzi,source);ids.add(source.id);
 }

 const grammarMap=new Map(restored.grammar.map(g=>[g.markup,g]));
 const grammarIds=new Set(restored.grammar.map(g=>g.id));
 for(const source of [...current.grammar,...master.grammar]){
  if(grammarMap.has(source.markup))continue;
  if(grammarIds.has(source.id))throw new Error('Grammar ID conflict while merging backup');
  grammarMap.set(source.markup,source);grammarIds.add(source.id);
 }
 if(wordMap.size>20000||grammarMap.size>20000)throw Error('Merged dictionary exceeds the 20,000-entry limit. Restore canceled.');
 restored.cards=[...wordMap.values()];
 restored.grammar=[...grammarMap.values()];
 // Keep existing synonym relationships and tags for matching backup words only
 // when absent from the backup; never mutate the historical review identity.
}
