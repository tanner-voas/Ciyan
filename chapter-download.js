import catalog from './chapters/index.js';
export {catalog};

// Our build writes one deflated chapter.json, without encryption or data descriptors.
export async function downloadChapter(entry){
 const url=new URL('./chapters/'+entry.file,import.meta.url);
 const response=await fetch(url);
 if(!response.ok)throw Error('Chapter download failed ('+response.status+'). Try again when online.');
 const bytes=new Uint8Array(await response.arrayBuffer());
 const view=new DataView(bytes.buffer);
 if(bytes.length<30||view.getUint32(0,true)!==0x04034b50||view.getUint16(6,true)!==0||view.getUint16(8,true)!==8||
    view.getUint32(22,true)!==entry.size)throw Error('Invalid chapter archive.');
 const start=30+view.getUint16(26,true)+view.getUint16(28,true),end=start+view.getUint32(18,true);
 if(end>bytes.length)throw Error('Incomplete chapter download.');
 const stream=new Blob([bytes.subarray(start,end)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 const data=await new Response(stream).arrayBuffer();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),n=>n.toString(16).padStart(2,'0')).join('');
 if(data.byteLength!==entry.size||hash!==entry.digest)throw Error('Chapter download failed its integrity check.');
 return data;
}
