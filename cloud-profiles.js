import {readRegistry,currentProfile,forkProfile,selectProfile,upsertProfile,status,remoteProfiles,createRemoteProfile,displayStatus} from './shared/google-drive/src/profiles.js';
import {ciyanDatabaseName,cloneCiyanData,ciyanHasData} from './shared/google-drive/src/local-data.js';
import {getSyncCursor,setSyncCursor,createSyncScheduler,fetchRevision,downloadBackup,splitBackup} from './shared/google-drive/src/sync.js';
import {chooseCiyanDatabase,loadState,saveState,makeBackup,parseBackup} from './storage.js';

let scheduler=null,phase='local',lastError='';
function cloudBackup(state){
 const backup=makeBackup(state);
 // Manual export status is not study data. Never hash moving wall-clock timestamps
 // into cloud chunks; that would upload a new version for every no-op sync.
 delete backup.state.lastBackupAt;
 delete backup.state.backedUpRevision;
 return backup;
}
const mark=(next,error='')=>{phase=next;lastError=error;window.dispatchEvent?.(new Event('ciyan-cloud-status'));};
export const syncLabel=()=>phase==='synced'?'Synced':phase==='syncing'?'Syncing':phase==='error'?`Sync error${lastError?': '+lastError:''}`:phase==='offline'?'Offline':'Local';
export const isUploading=()=>phase==='syncing';
export const isSynced=()=>phase==='synced';
export const cloudCurrentRevision=()=>currentProfile().remote?getSyncCursor(currentProfile().id,'ciyan')?.localRevision??-1:-1;

async function replaceLocal(backup,expectedRevision=null){
 const parsed=parseBackup(backup);if(!parsed.explicitDictionary&&(!parsed.cards.length||!parsed.grammar.length))throw Error('Cloud dictionary is incomplete');
 // Unlike a standard import, profile replacement never merges current data or
 // carries Azure credentials from a previous profile.
 delete parsed.deviceKey;
 await saveState(parsed,expectedRevision);
 return parsed;
}

async function verifiedFork(sourceId,reason){
 const name=`${currentProfile().name} (conflict ${new Date().toISOString().slice(0,10)})`;
 const id=forkProfile(sourceId,name);
 try{await cloneCiyanData(sourceId,id);}catch(e){throw Error(`Cannot preserve local edits as a profile fork: ${e.message}`);}
 // A fork is local-only until the user explicitly uploads it. It cannot create
 // repeated remote conflicts or change the remote revision by itself.
 selectProfile(id);mark('conflict');window.alert(`A different cloud revision was confirmed. Local edits were safely forked as “${name}”. ${reason}`);
 window.location.reload();
 return id;
}

/** Called before Ciyan boot so a new remote profile is never initialized as empty. */
export async function prepareCiyanProfile(){
 const registry=readRegistry(),profile=currentProfile();chooseCiyanDatabase(ciyanDatabaseName(profile.id,registry));
 let connected=false;
 try{connected=!!(await status()).connected;}catch{}
 if(!profile.remote||!connected){mark(profile.remote?'offline':'local');return;}
 let remote;
 try{remote=await fetchRevision(profile.id,'ciyan');}catch(e){
  if(!(await ciyanHasData(profile.id)))throw Error('Cloud profile cannot be downloaded. Reconnect or go online; no empty profile was created.');
  mark('offline',displayStatus(e));return;
 }
 const current=await loadState(),cursor=getSyncCursor(profile.id,'ciyan');
 if(!remote.head){
  if(cursor?.head)throw Error('Cloud history has disappeared. Local data was preserved. Resolve the cloud profile before syncing.');
  mark('pending');return;
 }
 if(!current){
  const snapshot=await downloadBackup(profile.id,'ciyan',remote.head);
  const parsed=await replaceLocal(snapshot);setSyncCursor(profile.id,'ciyan',{head:remote.head.id,localRevision:parsed.revision,pendingOperationId:null});mark('synced');return;
 }
 if(cursor?.head===remote.head.id){mark('pending');return;}
 if(cursor?.head&&cursor.head!==remote.head.id){
  if(cursor.localRevision===current.revision){
   const snapshot=await downloadBackup(profile.id,'ciyan',remote.head),parsed=await replaceLocal(snapshot,current.revision);
   setSyncCursor(profile.id,'ciyan',{head:remote.head.id,localRevision:parsed.revision,pendingOperationId:null});mark('synced');return;
  }
  await verifiedFork(profile.id,'Your existing cloud copy was not overwritten.');return;
 }
 // A lost cursor is not proof of a conflict. Verify content before deciding.
 const local=await splitBackup(cloudBackup(current));
 if(JSON.stringify(local.sections)===JSON.stringify(remote.head.sections)){
  setSyncCursor(profile.id,'ciyan',{head:remote.head.id,localRevision:current.revision,pendingOperationId:null});mark('synced');return;
 }
 // Never fork only because connection/cursor state was lost; require the user
 // to choose explicitly when two independently established roots are found.
 throw Error('This profile has local and cloud data but no common sync revision. Export a backup, then select which profile to keep. Nothing was changed.');
}

export async function startCiyanSync(readState){
 scheduler?.stop();scheduler=null;
 const profile=currentProfile();if(!profile.remote)return;
 let online=false;try{online=!!(await status()).connected;}catch{}
 if(!online){mark('offline');return;}
 const clouds=(await remoteProfiles()).profiles;
 if(!clouds.some(p=>p.id===profile.id)){mark('error','The cloud profile was not found');return;}
 scheduler=createSyncScheduler({profileId:profile.id,appId:'ciyan',
  readBackup:async()=>{const state=readState();return {backup:cloudBackup(state),revision:state.revision};},
  onStatus:x=>{mark(x.phase,x.error?.message||'');},
  onDivergence:async(result,input,cursor)=>{
   // Re-fetch, and only fork if a different committed head is confirmed.
   const checked=await fetchRevision(profile.id,'ciyan');
   if(!checked.head||checked.head.id===cursor.head){mark('pending');return;}
   // Content equality is not a fork even when another session updated metadata.
   const equal=JSON.stringify((await splitBackup(input.backup)).sections)===JSON.stringify(checked.head.sections);
   if(equal){setSyncCursor(profile.id,'ciyan',{head:checked.head.id,localRevision:input.revision,pendingOperationId:null});mark('synced');return;}
   if(cursor.localRevision===input.revision&&readState().revision===input.revision){
    const snapshot=await downloadBackup(profile.id,'ciyan',checked.head);
    await replaceLocal(snapshot,input.revision);
    setSyncCursor(profile.id,'ciyan',{head:checked.head.id,localRevision:parseBackup(snapshot).revision,pendingOperationId:null});location.reload();return;
   }
   await verifiedFork(profile.id,'You can later select the original cloud profile to retrieve its data.');
  }
 });
 const cursor=getSyncCursor(profile.id,'ciyan');
 if(cursor?.localRevision!==readState().revision||!cursor?.head)scheduler.changed();else mark('synced');
}
export const changedCiyanData=()=>scheduler?.changed();
export const syncNow=async()=>{if(!scheduler)throw Error('Connect and select a Google Drive profile first');await scheduler.now();};
export const disconnectCiyanSync=()=>{scheduler?.stop();scheduler=null;mark('offline');};
export async function cloudHistory(container){
 if(!container)return;const profile=currentProfile();if(!profile.remote){container.textContent='This is a local profile.';return;}
 const {api}=await import('./shared/google-drive/src/profiles.js');const history=(await api(`/profiles/${profile.id}/apps/ciyan/history`)).history;
 container.innerHTML='';if(!history.length){container.textContent='No cloud revisions yet.';return;}
 for(const r of history){const button=document.createElement('button');button.className='pwa-profile-row';button.textContent=`${new Date(r.at).toLocaleString()} · ${r.id.slice(0,8)}`;
  button.addEventListener('click',async()=>{
   if(!confirm('Restore this complete Ciyan version? The current local data will first be copied to a separate safety profile.'))return;
   try{
    // Never delete the previous database before verifying that the download is valid.
    const oldId=currentProfile().id;
    const result=await api(`/profiles/${oldId}/apps/ciyan/revisions/${r.id}`);const backup=await downloadBackup(oldId,'ciyan',result.revision);
    parseBackup(backup);
    const safetyId=forkProfile(oldId,`${currentProfile().name} (before restore)`);
    await cloneCiyanData(oldId,safetyId);
    const old=await loadState();const cloudHead=await fetchRevision(oldId,'ciyan');await replaceLocal(backup,old?.revision??null);
    setSyncCursor(oldId,'ciyan',{head:cloudHead.head?.id||null,localRevision:-1,pendingOperationId:null});location.reload();
   }catch(e){alert(`Restore cancelled: ${e.message}`);}
  });container.append(button);
 }
}
