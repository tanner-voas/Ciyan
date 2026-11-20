/** Optional Ciyan-to-AppLauncher contract. Standalone Ciyan needs no host. */
function launcherHost(){
  return globalThis.__APP_LAUNCHER__;
}

export function hasLauncherHost(){
  return typeof launcherHost()?.returnToLauncher === 'function';
}

export function runUpdateButton(button,options){
  const hosted=launcherHost();
  if(typeof hosted?.runUpdateButton === 'function')
    return hosted.runUpdateButton(button,options);
  // Standalone Ciyan uses its own service worker and the same bounded updater.
  return import('./pwa-update.js').then(({runUpdateButton:localUpdate})=>localUpdate(button,options));
}

export function returnToLauncher(){
  if(!hasLauncherHost())throw new Error('This Ciyan installation has no launcher.');
  return launcherHost().returnToLauncher();
}
