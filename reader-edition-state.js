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
