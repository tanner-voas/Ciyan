// The portable envelope carries only ciphertext. IndexedDB can separately
// retain the non-extractable CryptoKey for ordinary playback on this device.
const base64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const bytes=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
async function derive(pin,salt){
 if(!/^\d{4}$/.test(pin))throw Error('Enter a four-digit PIN.');
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export function validVault(v){
 return v?.version===1&&['salt','iv','data'].every(k=>typeof v[k]==='string'&&/^[A-Za-z0-9+/]+=*$/.test(v[k]))&&v.salt.length===24&&v.iv.length===16&&v.data.length<=4096;
}
export async function sealSpeech(pin,region,key){
 region=region.trim().toLowerCase();key=key.trim();
 if(!/^[a-z0-9]{1,64}$/.test(region)||!key||key.length>512)throw Error('Enter a valid Azure region and key.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),deviceKey=await derive(pin,salt);
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},deviceKey,new TextEncoder().encode(JSON.stringify({region,key})));
 return {speechVault:{version:1,salt:base64(salt),iv:base64(iv),data:base64(encrypted)},deviceKey};
}
export async function openSpeech(v,deviceKey){
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(v.iv)},deviceKey,bytes(v.data));
 return JSON.parse(new TextDecoder().decode(plain));
}
export async function unlockSpeech(v,pin){
 const deviceKey=await derive(pin,bytes(v.salt));
 try{return {deviceKey,...await openSpeech(v,deviceKey)};}catch{throw Error('PIN did not unlock these credentials. Try again.');}
}
