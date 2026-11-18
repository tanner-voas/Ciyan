// Backup format and app version are distinct. The former describes JSON shape;
// the latter selects explicitly ordered, content-aware transformations.
export const APP_VERSION='0.6.9';

// Add only intentional, reviewed transformations here in subsequent releases.
// Entries are adjacent application releases, including explicit identity steps.
// A v0.5.2 backup did not previously record appVersion, so this step is useful
// only for fixtures and for future versioned export compatibility tests.
const STEPS=new Map([
 ['0.5.2',{next:'0.5.3',apply:document=>document}],
 ['0.5.3',{next:'0.5.4',apply:document=>document}],
 ['0.5.4',{next:'0.5.5',apply:document=>document}],
 ['0.5.5',{next:'0.6.0',apply:document=>document}],
 ['0.6.0',{next:'0.6.1',apply:document=>document}],
 ['0.6.1',{next:'0.6.2',apply:document=>document}],
 ['0.6.2',{next:'0.6.3',apply:document=>document}],
 ['0.6.3',{next:'0.6.4',apply:document=>document}],
 ['0.6.4',{next:'0.6.5',apply:document=>document}],
 ['0.6.5',{next:'0.6.6',apply:document=>document}],
 ['0.6.6',{next:'0.6.7',apply:document=>document}],
 ['0.6.7',{next:'0.6.8',apply:document=>document}],
 ['0.6.8',{next:'0.6.9',apply:document=>document}]
]);

export function normalizeAppVersion(value){
 if(typeof value!=='string'||!/^v?\d+\.\d+\.\d+$/.test(value))throw new Error('Invalid backup app version');
 return value.replace(/^v/,'');
}
function compareVersions(a,b){
 const left=a.split('.').map(Number),right=b.split('.').map(Number);
 for(let i=0;i<3;i++)if(left[i]!==right[i])return left[i]<right[i]?-1:1;
 return 0;
}
export function prepareVersionedBackup(input){
 if(!input||typeof input!=='object')throw new Error('Not a Cíyán backup');
 // Prior backups have no appVersion. They have no reliable origin marker, so
 // never guess source-specific transformations. Existing structural validation
 // still applies; no old tag or timing value is rewritten.
 if(input.appVersion===undefined)return input;
 const from=normalizeAppVersion(input.appVersion),to=APP_VERSION;
 if(compareVersions(from,to)>0)throw new Error(`Backup is from newer Cíyán ${from}; update the app to restore it.`);
 if(from===to)return input;
 const output=structuredClone(input),visited=new Set();
 let current=from;
 while(current!==to){
  if(visited.has(current))throw new Error('Backup migration cycle detected');
  visited.add(current);
  const step=STEPS.get(current);
  if(!step||compareVersions(step.next,to)>0||compareVersions(step.next,current)<=0)
   throw new Error(`No supported backup migration from Cíyán ${current} to ${to}.`);
  const transformed=step.apply(output);
  if(transformed!==output)throw new Error('Backup migration must edit the staged document in place');
  current=step.next;output.appVersion=current;
 }
 return output;
}
