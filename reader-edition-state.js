export const editionId=p=>!p?.graded?'original':p.level==='hsk4'?'hsk4':p.level==='hsk5'?'hsk5':'graded';
const empty=()=>({complete:false,unlocked:false,position:null});
export function editionState(c,edition){
 if(!c)return empty();
 if(c.editionStates)return c.editionStates[edition]||empty();
 // Legacy shared state can only be attributed to the last selected edition.
 return edition===editionId(c.editionPrefs)?{complete:c.complete,unlocked:c.unlocked,position:c.position}:empty();
}
export function writeEditionState(c,edition,patch){
 if(!c.editionStates)c.editionStates={[editionId(c.editionPrefs)]:editionState(c,editionId(c.editionPrefs))};
 c.editionStates[edition]={...editionState(c,edition),...patch};
}
export const paragraphId=(edition,id)=>`${edition}:${id}`;
export function scopedPosition(pos,edition){return pos?{...pos,id:pos.id.startsWith(edition+':')?pos.id:paragraphId(edition,pos.id)}:null;}

export const EDITIONS=['original','graded','hsk5','hsk4'];
// A new edition starts at its first available chapter; a legacy cursor belongs
// only to the last selected edition, never to every edition.
export function resumeEditionChapter(book,edition,available){
 const numbers=available.map(c=>typeof c==='number'?c:c.number);
 const legacy=book?.activeEdition??editionId(book?.chapters?.[book?.current-1]?.editionPrefs);
 const saved=book?.editionCurrent?.[edition]??(!book?.editionCurrent&&legacy===edition?book?.current:undefined);
 return numbers.includes(saved)?saved:numbers[0];
}
export function preserveLegacyEditionCursor(book){
 if(book.editionCurrent)return;
 const active=book.activeEdition??editionId(book.chapters?.[book.current-1]?.editionPrefs);
 book.editionCurrent=book.current>0?{[active]:book.current}:{};
}
export function rememberEditionChapter(book,edition,number){
 preserveLegacyEditionCursor(book);
 book.current=number;book.activeEdition=edition;book.editionCurrent={...book.editionCurrent,[edition]:number};
}
export function selectEditionPrefs(pref,edition){
 const next={...pref,graded:edition!=='original',restored:[]};
 if(edition==='hsk4'||edition==='hsk5')next.level=edition;
 else if(edition==='graded')delete next.level;
 return next;
}
