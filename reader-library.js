import masterCatalog from './chapters/index.js';

// The master index ships with the app; custom metadata travels in the full
// backup. Neither index contains reading text, which lives only in CacheStorage.
const safeId=id=>typeof id==='string'&&/^[a-z0-9-]{1,160}$/.test(id)&&!Object.hasOwn(Object.prototype,id);
const safeLabel=(s,max)=>typeof s==='string'&&s.length>0&&s.length<=max;
const hash=d=>typeof d==='string'&&/^[a-f0-9]{64}$/.test(d);
export function validateReaderCustomIndex(index={}){
 if(index==null)return {};
 if(typeof index!=='object'||Array.isArray(index))throw Error('Invalid custom novel index');
 const result={};let count=0;
 for(const [id,b] of Object.entries(index)){
  if(!safeId(id)||!b||!safeLabel(b.title,120)||!Array.isArray(b.chapters)||b.chapters.length>1000)
   throw Error('Invalid custom novel entry');
  const chapters=[];const seen=new Set();
  for(const ch of b.chapters){
   if(!ch||!Number.isSafeInteger(ch.number)||ch.number<1||ch.number>1000||seen.has(ch.number)||
      !safeLabel(ch.title,200)||!hash(ch.digest)||!Number.isSafeInteger(ch.revision)||ch.revision<1)
    throw Error('Invalid custom chapter index');
   chapters.push({number:ch.number,title:ch.title,digest:ch.digest,revision:ch.revision});seen.add(ch.number);
   if(++count>2000)throw Error('Too many custom chapters');
  }
  result[id]={title:b.title,chapters:chapters.sort((a,b)=>a.number-b.number)};
 }
 return result;
}
// A recovery upload must match the requested chapter. An unchanged revision
// must have the original digest; an explicitly newer revision is permitted.
export function matchesRequestedChapter(chapter,requested,digest){
 if(!requested)return true;
 return chapter.novel===requested.novel&&chapter.number===requested.number&&
  (chapter.revision>requested.revision||
   (chapter.revision===requested.revision&&digest===requested.digest));
}
export function registerCustomChapter(state,chapter,digest){
 if(masterCatalog.some(c=>c.novel===chapter.novel&&c.number===chapter.number&&c.digest===digest))return;
 state.readerCustomIndex??={};
 const b=state.readerCustomIndex[chapter.novel]??{title:chapter.book,chapters:[]};
 b.title=chapter.book;
 b.chapters=b.chapters.filter(c=>c.number!==chapter.number);
 b.chapters.push({number:chapter.number,title:chapter.title,revision:chapter.revision,digest});
 b.chapters.sort((a,b)=>a.number-b.number);
 state.readerCustomIndex[chapter.novel]=b;
}
export function novelLibrary(state){
 const books=new Map();
 const add=(id,title,entry)=>{
  if(!books.has(id))books.set(id,{novel:id,title,chapters:new Map()});
  const b=books.get(id);b.chapters.set(entry.number,entry);
 };
 for(const c of masterCatalog)add(c.novel,c.book,{...c,source:'master'});
 // Historic imported, non-hosted chapters are reconstructed for old backups.
 for(const [id,b] of Object.entries(state.reader||{}))for(const c of b.chapters||[]){
  if(!masterCatalog.some(x=>x.novel===id&&x.number===c.number&&x.digest===c.digest))
   add(id,b.title,{novel:id,number:c.number,title:c.title,digest:c.digest,revision:c.revision,source:'custom'});
 }
 for(const [id,b] of Object.entries(state.readerCustomIndex||{}))for(const c of b.chapters||[]){
  add(id,b.title,{...c,novel:id,source:'custom'});
 }
 return [...books.values()].map(b=>({novel:b.novel,title:b.title,chapters:[...b.chapters.values()].sort((a,b)=>a.number-b.number)}));
}
