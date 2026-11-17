// Applied preferences live in Settings and full progress backups, never in cards.
// A tag is a leaf only if no other loaded tag is below it in the tree.
export function leafTagPaths(cards){
 const paths=[...new Set(cards.flatMap(c=>Array.isArray(c.tags)?c.tags:[]).filter(x=>typeof x==='string'&&x.trim()))].sort();
 return paths.filter(t=>!paths.some(other=>other.startsWith(t+'/')));
}
export function validTagWeight(value){
 const weight=Number(value);
 if(!Number.isFinite(weight)||weight<1||weight>1000000)throw new Error('Tag weights must be between 1 and 1,000,000.');
 return weight;
}
export function validatedTagWeights(input){
 if(input==null)return {};
 if(typeof input!=='object'||Array.isArray(input))throw new Error('Invalid tag-weight settings');
 const result={};
 for(const [key,weight] of Object.entries(input)){
  if(!key||key.length>160||key==='__proto__'||key==='prototype'||key==='constructor')throw new Error('Invalid tag-weight path');
  Object.defineProperty(result,key,{value:validTagWeight(weight),enumerable:true,writable:true,configurable:true});
 }
 return result;
}
export function weightForNewCard(card,weights={},leaves=null){
 const allowed=leaves instanceof Set?leaves:leaves?new Set(leaves):null;
 const tags=[...new Set(card.tags||[])].filter(t=>!allowed||allowed.has(t));
 return tags.length?tags.reduce((sum,t)=>sum+(weights[t]??1),0):1;
}
export function newWordOdds(cards,schedules={},weights={}){
 const leaves=leafTagPaths(cards),leafSet=new Set(leaves),weighted=Object.fromEntries(leaves.map(t=>[t,0]));
 const counts=Object.fromEntries(leaves.map(t=>[t,0]));let totalWeight=0,newCount=0,untagged=0;
 for(const card of cards){
  if(schedules[card.id])continue;
  newCount++;
  const own=[...new Set(card.tags||[])].filter(t=>leafSet.has(t));
  const cardWeight=own.length?own.reduce((sum,t)=>sum+(weights[t]??1),0):1;
  totalWeight+=cardWeight;
  if(!own.length)untagged++;
  for(const t of own){weighted[t]+=cardWeight;counts[t]++;}
 }
 return {leaves,weighted,counts,newCount,totalWeight,untagged,odds:Object.fromEntries(leaves.map(t=>[t,totalWeight?100*weighted[t]/totalWeight:0]))};
}
