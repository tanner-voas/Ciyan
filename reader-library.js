import masterCatalog from './chapters/index.js';

// Master novels are shipped as metadata only. User-uploaded chapter text is
// kept in CacheStorage, while custom author/volume/catalog metadata is saved
// with the full backup. Volumes are navigation filters, never reading locks.
const safeId=id=>typeof id==='string'&&/^[a-z0-9-]{1,160}$/.test(id)&&!Object.hasOwn(Object.prototype,id);
const safeLabel=(s,max)=>typeof s==='string'&&s.length>0&&s.length<=max;
const hash=d=>typeof d==='string'&&/^[a-f0-9]{64}$/.test(d);
const validVolume=v=>Number.isSafeInteger(v)&&v>=1&&v<=999;
const readerSort=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
export const volumeLabel=(number,title='')=>`V${String(number).padStart(2,'0')}${title?' · '+title:''}`;
export function volumeList(book){
 const volumes=new Map();
 for(const chapter of book?.chapters||[]){
  if(!validVolume(chapter.volume))continue;
  const title=chapter.volumeTitle||'';
  if(!volumes.has(chapter.volume)||(!volumes.get(chapter.volume)&&title))volumes.set(chapter.volume,title);
 }
 return [...volumes].sort((a,b)=>a[0]-b[0]).map(([number,title])=>({number,title,label:volumeLabel(number,title)}));
}
export const chaptersInVolume=(book,volume)=>book?.chapters.filter(c=>c.volume===volume)||[];
export function validateReaderCustomIndex(index={}){
 if(index==null)return {};
 if(typeof index!=='object'||Array.isArray(index))throw Error('Invalid custom novel index');
 const result={};let count=0;
 for(const [id,b] of Object.entries(index)){
  if(!safeId(id)||!b||!safeLabel(b.title,120)||!Array.isArray(b.chapters)||b.chapters.length>1000||
     (b.author!==undefined&&!safeLabel(b.author,120)))throw Error('Invalid custom novel entry');
  const chapters=[];const seen=new Set();
  for(const ch of b.chapters){
   if(!ch||!Number.isSafeInteger(ch.number)||ch.number<1||ch.number>1000||seen.has(ch.number)||
      !safeLabel(ch.title,200)||!hash(ch.digest)||!Number.isSafeInteger(ch.revision)||ch.revision<1||
      (ch.volume!==undefined&&!validVolume(ch.volume))||
      (ch.volumeTitle!==undefined&&(!safeLabel(ch.volumeTitle,120)||!validVolume(ch.volume))))
    throw Error('Invalid custom chapter index');
   const entry={number:ch.number,title:ch.title,digest:ch.digest,revision:ch.revision};
   if(ch.volume!==undefined)entry.volume=ch.volume;
   if(ch.volumeTitle!==undefined)entry.volumeTitle=ch.volumeTitle;
   chapters.push(entry);seen.add(ch.number);
   if(++count>2000)throw Error('Too many custom chapters');
  }
  const item={title:b.title,chapters:chapters.sort((a,b)=>a.number-b.number)};
  if(b.author!==undefined)item.author=b.author;
  result[id]=item;
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
 if(chapter.author)b.author=chapter.author;
 b.chapters=b.chapters.filter(c=>c.number!==chapter.number);
 const entry={number:chapter.number,title:chapter.title,revision:chapter.revision,digest};
 if(chapter.volume!==undefined)entry.volume=chapter.volume;
 if(chapter.volumeTitle!==undefined)entry.volumeTitle=chapter.volumeTitle;
 b.chapters.push(entry);
 b.chapters.sort((a,b)=>a.number-b.number);
 state.readerCustomIndex[chapter.novel]=b;
}
export function novelLibrary(state){
 const books=new Map();
 const add=(id,title,author,entry)=>{
  if(!books.has(id))books.set(id,{novel:id,title,author:author||'Unknown author',sortAuthor:entry.authorSort||author||'Unknown author',chapters:new Map()});
  const b=books.get(id);b.chapters.set(entry.number,entry);
 };
 for(const c of masterCatalog)add(c.novel,c.book,c.author,{...c,source:'master'});
 // Historic imported, non-hosted chapters are reconstructed for old backups.
 for(const [id,b] of Object.entries(state.reader||{}))for(const c of b.chapters||[]){
  if(!masterCatalog.some(x=>x.novel===id&&x.number===c.number&&x.digest===c.digest)){
   const meta=state.readerCustomIndex?.[id],record=meta?.chapters.find(x=>x.number===c.number);
   add(id,meta?.title||b.title,meta?.author,{...c,...record,novel:id,source:'custom'});
  }
 }
 for(const [id,b] of Object.entries(state.readerCustomIndex||{}))for(const c of b.chapters||[]){
  add(id,b.title,b.author,{...c,novel:id,source:'custom'});
 }
 return [...books.values()].map(b=>({novel:b.novel,title:b.title,author:b.author,chapters:[...b.chapters.values()].sort((a,b)=>a.number-b.number)}))
  .sort((a,b)=>readerSort.compare(a.sortAuthor,b.sortAuthor)||readerSort.compare(a.title,b.title)||readerSort.compare(a.novel,b.novel));
}
