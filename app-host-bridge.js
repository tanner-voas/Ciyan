/** Ciyan-to-AppLauncher contract. Ciyan never imports launcher internals. */
function requireHost(method){
  const host=globalThis.__APP_LAUNCHER__;
  if(!host || typeof host[method] !== 'function')
    throw new Error('Ciyan must be opened from AppLauncher.');
  return host[method].bind(host);
}

export function runUpdateButton(button,options){
  return requireHost('runUpdateButton')(button,options);
}

export function returnToLauncher(){
  return requireHost('returnToLauncher')();
}
