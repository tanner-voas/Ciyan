// Backup format and app version are distinct. The former describes JSON shape;
// the latter selects explicitly ordered, content-aware transformations.
export const APP_VERSION='0.9.21';

// Add only intentional, reviewed transformations here in subsequent releases.
// Entries are adjacent application releases, including explicit identity steps.
// A v0.5.2 backup did not previously record appVersion, so this step is useful
// only for fixtures and for future versioned export compatibility tests.
const STEPS=new Map([
 ['0.9.20',{next:'0.9.21',apply:document=>document}],
 ['0.9.19',{next:'0.9.20',apply:document=>document}],
 ['0.9.18',{next:'0.9.19',apply:document=>document}],
 ['0.9.17',{next:'0.9.18',apply:document=>document}],
 ['0.9.16',{next:'0.9.17',apply:document=>document}],
 ['0.9.15',{next:'0.9.16',apply:document=>document}],
 ['0.9.14',{next:'0.9.15',apply:document=>document}],
 ['0.9.13',{next:'0.9.14',apply:document=>document}],
 ['0.9.12',{next:'0.9.13',apply:document=>document}],
 ['0.9.11',{next:'0.9.12',apply:document=>document}],
 ['0.9.10',{next:'0.9.11',apply:document=>document}],
 ['0.9.9',{next:'0.9.10',apply:document=>document}],
 ['0.9.8',{next:'0.9.9',apply:document=>document}],
 ['0.9.7',{next:'0.9.8',apply:document=>document}],
 ['0.9.6',{next:'0.9.7',apply:document=>document}],
 ['0.9.5',{next:'0.9.6',apply:document=>document}],
 ['0.9.4',{next:'0.9.5',apply:document=>document}],
 ['0.9.3',{next:'0.9.4',apply:document=>document}],
 ['0.9.2',{next:'0.9.3',apply:document=>document}],
 ['0.9.1',{next:'0.9.2',apply:document=>document}],
 ['0.9.0',{next:'0.9.1',apply:document=>document}],
 ['0.8.18',{next:'0.9.0',apply:document=>document}],
 ['0.8.17',{next:'0.8.18',apply:document=>document}],
 ['0.8.16',{next:'0.8.17',apply:document=>document}],
 ['0.8.15',{next:'0.8.16',apply:document=>document}],
 ['0.8.14',{next:'0.8.15',apply:document=>document}],
 ['0.8.13',{next:'0.8.14',apply:document=>document}],
 ['0.8.12',{next:'0.8.13',apply:document=>document}],
 ['0.8.11',{next:'0.8.12',apply:document=>document}],
 ['0.8.10',{next:'0.8.11',apply:document=>document}],
 ['0.8.9',{next:'0.8.10',apply:document=>document}],
 ['0.8.8',{next:'0.8.9',apply:document=>document}],
 ['0.8.7',{next:'0.8.8',apply:document=>document}],
 ['0.8.6',{next:'0.8.7',apply:document=>document}],
 ['0.8.5',{next:'0.8.7',apply:document=>document}],
 ['0.8.4',{next:'0.8.5',apply:document=>document}],
 ['0.8.3',{next:'0.8.4',apply:document=>document}],
 ['0.8.2',{next:'0.8.3',apply:document=>document}],
 ['0.8.1',{next:'0.8.2',apply:document=>document}],
 ['0.8.0',{next:'0.8.1',apply:document=>document}],
 ['0.7.9',{next:'0.8.0',apply:document=>document}],
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
 ['0.6.8',{next:'0.6.9',apply:document=>document}],
 ['0.7.8',{next:'0.7.9',apply:document=>document}],
 ['0.7.7',{next:'0.7.8',apply:document=>document}],
 ['0.7.6',{next:'0.7.7',apply:document=>document}],
 ['0.7.5',{next:'0.7.6',apply:document=>document}],
 ['0.7.4',{next:'0.7.5',apply:document=>document}],
 ['0.7.3',{next:'0.7.4',apply:document=>document}],
 ['0.7.2',{next:'0.7.3',apply:document=>document}],
 ['0.7.1',{next:'0.7.2',apply:document=>document}],
 ['0.7.0',{next:'0.7.1',apply:document=>document}],
 ['0.6.9',{next:'0.7.0',apply:document=>document}]
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
