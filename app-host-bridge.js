/** Optional Ciyan-to-AppLauncher contract. Standalone Ciyan needs no host. */
import {hasLauncherHost,returnToLauncher as hostReturn,runHostedOrLocalUpdate} from './browser-host.js';
export {hasLauncherHost};
export function runUpdateButton(button,options){
  return runHostedOrLocalUpdate(button,options,(b,o)=>import('./pwa-update.js').then(({runUpdateButton:localUpdate})=>localUpdate(b,o)));
}
export function returnToLauncher(){
  if(!hasLauncherHost())throw new Error('This Ciyan installation has no launcher.');
  return hostReturn();
}
