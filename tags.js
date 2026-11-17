// Slash-delimited paths. Parent matching is boundary-aware (HSK1 != HSK10).
const groups={
 HSK:[],Food:['food','china-food','global-food','ingredients','ordering'],
 Places:['places','china-regions','cities','countries','eu-capitals','major-cities','us-states','visited','world-capitals'],
 Activities:['activities','climbing','fitness','sports'],Health:['body','health','sleep'],
 Grammar:['grammar','grammar-support','grammar-words','connectives','measure-words'],
 Everyday:['basics','daily','errands','foundations','housing','numbers','practical','shopping','time'],
 Conversation:['conversation','fluency','friend-chat','relationships','social','slang','modern'],
 Travel:['traffic','transport','travel'],Work:['work','professional','technology'],
 Learning:['language','study'],Nature:['nature','weather']};
export function tagPath(value){
 const t=String(value??'').trim().split('/').map(x=>x.trim()).filter(Boolean).join('/');
 if(!t)return '';
 if(t.includes('/')||Object.hasOwn(groups,t)||t==='Topics')return t;
 if(/^hsk[1-9]/i.test(t))return 'HSK/'+t.toUpperCase();
 for(const [root,leaves] of Object.entries(groups))if(leaves.includes(t.toLowerCase()))return root+'/'+t.toLowerCase();
 return 'Topics/'+t;
}
export const normalizeTags=tags=>[...new Set(tags.map(tagPath).filter(Boolean))];
export function tagMatches(tags,path){const p=path.toLowerCase();return tags.some(t=>{t=tagPath(t).toLowerCase();return t===p||t.startsWith(p+'/');});}
export function matchesTagFilters(tags,filters){return Object.entries(filters).every(([p,v])=>!v||(v===1?tagMatches(tags,p):!tagMatches(tags,p)));}
export function tagNodes(tags){const nodes=new Map();for(const t of normalizeTags(tags)){const parts=t.split('/');for(let i=1;i<=parts.length;i++){const path=parts.slice(0,i).join('/');nodes.set(path,{path,label:parts[i-1],parent:parts.slice(0,i-1).join('/'),depth:i-1});}}return [...nodes.values()].sort((a,b)=>a.path.localeCompare(b.path));}
