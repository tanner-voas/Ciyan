/** Optional, user-controlled portable copy of imported chapter text.
 * Only explicitly imported, non-hosted chapters are included. Downloaded
 * public reader packs remain independently recoverable from the app bundle.
 */
const MAX_CHAPTER=8*1024*1024;
const MAX_TOTAL=128*1024*1024;
const CACHE_NAME='ciyan-reader-text-v1';
const DIGEST=/^[0-9a-f]{64}$/;
const cacheKey=digest=>new URL('./reader-content/'+digest,globalThis.location.href).href;
const checksum=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
export function customReaderEntries(state){
 const entries=new Map();
 for(const [novel,book] of Object.entries(state.readerCustomIndex||{}))for(const item of book.chapters||[]){
  if(!DIGEST.test(item.digest)||entries.has(item.digest))continue;
  entries.set(item.digest,{novel,number:item.number,digest:item.digest});
 }
 return [...entries.values()];
}
export async function collectCustomReaderText(state){
 const entries=customReaderEntries(state),result={};
 if(!entries.length)return result;
 const cache=await caches.open(CACHE_NAME);let total=0;
 for(const {novel,number,digest} of entries){
  const response=await cache.match(cacheKey(digest));
  if(!response)throw Error(`Imported reader chapter ${novel}/${number} is missing from this device; reimport it or disable reader-text cloud backup.`);
  const bytes=await response.arrayBuffer();total+=bytes.byteLength;
  if(bytes.byteLength>MAX_CHAPTER||total>MAX_TOTAL)throw Error('Imported reader text exceeds the portable backup size limit');
  if(await checksum(bytes)!==digest)throw Error(`Imported reader chapter ${novel}/${number} failed its checksum`);
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const chapter=JSON.parse(text);
  if(chapter.novel!==novel||chapter.number!==number)throw Error('Imported chapter does not match its metadata');
  result[digest]=text;
 }
 return result;
}
/** Validate every byte before storing; an interrupted restore never deletes a valid cached chapter. */
export async function restoreCustomReaderText(state,texts){
 if(texts==null)return 0;
 if(!texts||typeof texts!=='object'||Array.isArray(texts))throw Error('Invalid portable chapter bundle');
 const refs=new Map(customReaderEntries(state).map(x=>[x.digest,x]));
 let total=0;const valid=[];
 for(const [digest,text] of Object.entries(texts)){
  if(!DIGEST.test(digest)||!refs.has(digest)||typeof text!=='string')throw Error('Unexpected imported chapter in backup');
  const bytes=new TextEncoder().encode(text);total+=bytes.byteLength;
  if(bytes.byteLength>MAX_CHAPTER||total>MAX_TOTAL||await checksum(bytes)!==digest)throw Error('Portable reader text failed integrity validation');
  const parsed=JSON.parse(text),expected=refs.get(digest);
  if(parsed.novel!==expected.novel||parsed.number!==expected.number)throw Error('Portable reader chapter identity mismatch');
  valid.push([digest,text]);
 }
 const cache=await caches.open(CACHE_NAME);
 for(const [digest,text] of valid)await cache.put(cacheKey(digest),new Response(text,{headers:{'Content-Type':'application/json'}}));
 return valid.length;
}
