import {downloadText} from './browser-files.js';
import {currentProfile,upsertProfile,selectProfile,readRegistry} from './shared/google-drive/src/profiles.js';
import {cloneCiyanData,ciyanDatabaseName} from './shared/google-drive/src/local-data.js';
import {fetchRevision,downloadBackup,setSyncCursor} from './shared/google-drive/src/sync.js';
import {loadState,makeBackup,parseBackup,saveState} from './storage.js';
import {collectCustomReaderText,restoreCustomReaderText} from './reader-portability.js';

const node=(tag,label)=>{const el=document.createElement(tag);el.textContent=label;return el;};
const download=(filename,json)=>downloadText(JSON.stringify(json),filename);
/** Do not start Ciyan against a mismatched cloud database until the owner chooses. */
export async function showCloudRecovery(host,error){
 if(error?.code!=='CIYAN_CLOUD_RECOVERY')return false;
 const p=currentProfile(),frame=node('section');frame.style.cssText='max-width:540px;margin:32px auto;padding:24px;border-radius:16px;background:var(--surface,#fff);color:var(--ink,#172c26);line-height:1.6';
 frame.append(node('h2','Choose a safe profile recovery'),node('p',`Local profile “${p.name}” and its Google Drive backup differ, but their synchronization cursor was lost. Both copies are preserved. No automatic replacement or cloud overwrite was performed.`));
 const message=node('p','');frame.append(message);
 let busy=false;
 const act=(label,action)=>{const b=node('button',label);b.type='button';b.style.cssText='display:block;padding:12px;margin:10px 0;width:100%';b.onclick=async()=>{
  if(busy)return;busy=true;for(const button of frame.querySelectorAll('button'))button.disabled=true;message.textContent='Verifying and preserving data…';
  try{await action();}catch(e){message.textContent=`Recovery did not complete: ${e.message}`;}finally{busy=false;for(const button of frame.querySelectorAll('button'))button.disabled=false;}
 };frame.append(b);return b;};
 act('Export the current local backup (recommended first)',async()=>{
  const state=await loadState();if(!state)throw Error('Local profile data is missing');const backup=makeBackup(state);
  try{backup.state.readerContent=await collectCustomReaderText(state);}catch{message.textContent='Reader-text files were not all available. Learning records and settings will still be exported.';}
  download(`ciyan-${p.name.replace(/[^A-Za-z0-9_-]+/g,'_')}-recovery.json`,backup);
 });
 act('Preserve local as a separate profile and restore Google Drive',async()=>{
  const current=await loadState();if(!current)throw Error('Local database is unavailable');
  const fetched=await fetchRevision(p.id,'ciyan');if(!fetched.head)throw Error('No cloud head is available; local copy unchanged');
  const backup=await downloadBackup(p.id,'ciyan',fetched.head),parsed=parseBackup(backup);
  // Construct all required metadata before changing either database.
  const id=crypto.randomUUID();await cloneCiyanData(p.id,id);
  upsertProfile({id,name:`${p.name} (local recovery)`,remote:false});
  await restoreCustomReaderText(parsed,backup.state.readerContent);
  await saveState(parsed,current.revision);
  setSyncCursor(p.id,'ciyan',{head:fetched.head.id,localRevision:parsed.revision,pendingOperationId:null,pendingRevisionId:null});
  location.reload();
 });
 act('Continue with a local-only copy; do not modify the cloud',async()=>{
  const id=crypto.randomUUID();await cloneCiyanData(p.id,id);
  upsertProfile({id,name:`${p.name} (local recovery)`,remote:false});
  selectProfile(id);location.reload();
 });
 frame.append(node('p','Recovery never uploads data to Google Drive or deletes the previous local database. The new local recovery profile is available in Switch Profile.'));
 host.replaceChildren(frame);return true;
}
