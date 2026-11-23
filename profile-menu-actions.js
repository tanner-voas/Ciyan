/** App-specific hooks for the shared profile manager.
 * Keeping this adapter explicit makes it impossible for the UI to display
 * Push/Sync without an implementation, and gives us a small testable contract.
 */
export function createCiyanProfileActions({readState,statusText,flush,disconnectSync,pushProfile,syncProfile,cloneProfile}){
 return {
  statusText,
  beforeSwitch:async()=>{await flush();disconnectSync();},
  beforeDisconnect:flush,
  onDisconnected:disconnectSync,
  // Push is a full first backup, not merely creation of Drive metadata.
  onPush:({targetId=null,name})=>pushProfile({targetId,name,readState,beforeUpload:flush}),
  onSync:async()=>{await flush();return syncProfile();},
  // The shared manager owns the new profile ID; only Ciyan copies its data.
  onFork:({sourceId,id})=>cloneProfile(sourceId,id)
 };
}
