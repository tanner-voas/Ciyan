/** Presentation state for the archived-backup button. Red means a real error. */
export function backupIndicator({remote=false,revision=0,backedUpRevision=-1,phase='local',cloudRevision=-1,progress=null,error=''}={}){
 const failed=phase==='error'||phase==='conflict';
 const uploading=phase==='syncing';
 const confirmed=remote?(phase==='synced'||phase==='offline')&&cloudRevision>=0&&revision===cloudRevision:revision<=backedUpRevision;
 const mode=failed?'error':uploading?'uploading':confirmed?'saved':'pending';
 const total=Number.isFinite(progress?.total)&&progress.total>0?progress.total:0;
 const completed=Math.max(0,Math.min(total,Number(progress?.completed)||0));
 const percent=uploading&&(progress?.stage==='committing'||progress?.stage==='verifying')?100:total?Math.round(100*completed/total):0;
 const label=mode==='error'?`Backup error${error||progress?.error?': '+String(error||progress?.error?.message||progress?.error):''}`:
  mode==='uploading'?`Backing up ${completed} of ${total} sections${progress?.stage==='committing'||progress?.stage==='verifying'?' (finalizing)':''}`:
  mode==='saved'?'Current revision backed up':'Changes saved locally; cloud backup pending';
 return {mode,percent,completed,total,label};
}
