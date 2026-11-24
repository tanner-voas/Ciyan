// Version 1: four-digit convenience PIN, retained for historical backups.
// Version 2: exact passphrase (no normalization), fixed stronger PBKDF2 profile.
const base64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const bytes=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export const isPin=secret=>typeof secret==='string'&&/^\d{4}$/.test(secret);
export const isPassphrase=secret=>typeof secret==='string'&&secret.length>=12&&secret.length<=256&&!/^\s*$/.test(secret);
const versionFor=secret=>isPin(secret)?1:isPassphrase(secret)?2:0;
async function derive(secret,salt,version){
 if(version===1?!isPin(secret):version!==2||!isPassphrase(secret))throw Error(version===1?'Enter a four-digit PIN.':'Enter a passphrase of 12–256 characters.');
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:version===1?210000:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export function validVault(v){
 if(![1,2].includes(v?.version)||!['salt','iv','data'].every(k=>typeof v[k]==='string'&&/^[A-Za-z0-9+/]+=*$/.test(v[k]))||v.salt.length!==24||v.iv.length!==16||v.data.length>4096)return false;
 try{return bytes(v.salt).length===16&&bytes(v.iv).length===12&&bytes(v.data).length>=16;}catch{return false;}
}
export async function sealSpeech(secret,region,key){
 region=region.trim().toLowerCase();key=key.trim();
 if(!/^[a-z0-9]{1,64}$/.test(region)||!key||key.length>512)throw Error('Enter a valid Azure region and key.');
 return seal(secret,{region,key});
}
export function sealSpeechKey(secret,key){
 if(typeof key!=='string'||key.length>512)throw Error('Enter a valid Azure key.');
 return seal(secret,{key});
}
async function seal(secret,payload){
 const version=versionFor(secret);if(!version)throw Error('Use a four-digit PIN or a passphrase of 12–256 characters.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),deviceKey=await derive(secret,salt,version);
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},deviceKey,new TextEncoder().encode(JSON.stringify(payload)));
 return {speechVault:{version,salt:base64(salt),iv:base64(iv),data:base64(encrypted)},deviceKey};
}
export async function openSpeech(v,deviceKey){
 if(!validVault(v))throw Error('Invalid encrypted speech credentials.');
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(v.iv)},deviceKey,bytes(v.data));
 return JSON.parse(new TextDecoder().decode(plain));
}
export async function unlockSpeech(v,secret){
 if(!validVault(v))throw Error('Invalid encrypted speech credentials.');
 const deviceKey=await derive(secret,bytes(v.salt),v.version);
 try{return {deviceKey,...await openSpeech(v,deviceKey)};}catch{throw Error((v.version===1?'PIN':'Passphrase')+' did not unlock these credentials. Try again.');}
}
