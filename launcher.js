// v0.8.14: one installed PWA, independently loaded app runtimes.
// Only the selected app's module is imported; going Home unloads its entire runtime.
// Add future entries here, with their own modules and storage namespaces.
export const APPS = Object.freeze([
  {id:'ciyan',name:'Cíyán',description:'Mandarin learning',glyph:'词',module:'./app.js'}
]);

export function launcherUrl(current){return new URL('./',current).href;}
export function appLaunchUrl(current,id){
  if(!APPS.some(app=>app.id===id))throw new Error('Unknown app');
  const next=new URL(launcherUrl(current));next.searchParams.set('app',id);return next.href;
}
export function activeAppId(current){
  const url=new URL(current);const id=url.searchParams.get('app');
  return APPS.some(app=>app.id===id)?id:null;
}

export function homeScreen(current){
  const tiles=APPS.map(app=>`<a class="launcher-tile" href="${appLaunchUrl(current,app.id)}" aria-label="Open ${app.name}"><span class="launcher-tile-icon" aria-hidden="true">${app.glyph}</span><span class="launcher-tile-name">${app.name}</span><span class="launcher-tile-description">${app.description}</span></a>`).join('');
  return `<div class="launcher-screen"><header class="launcher-header"><span class="launcher-eyebrow">YOUR WORKSPACE</span><div class="launcher-monogram" aria-hidden="true">M</div></header>
    <h1 class="launcher-title">My Apps</h1><p class="launcher-subtitle">Your apps, in one place.</p>
    <section class="launcher-section" aria-labelledby="launcher-apps-heading"><div class="launcher-section-heading"><h2 id="launcher-apps-heading">Installed apps</h2><span>${APPS.length} ${APPS.length===1?'app':'apps'}</span></div>
    <div class="launcher-grid">${tiles}</div></section></div>`;
}

export async function startLauncher(){
  const id=activeAppId(location.href);
  if(id==='ciyan'){
    document.title='Cíyán v0.8.14';
    await import('./app.js');
    return;
  }
  document.title='My Apps';
  document.body.classList.add('launcher-mode');
  document.querySelector('#app').innerHTML=homeScreen(location.href);
  // The launcher does not read Cíyán's IndexedDB data or initialize its app.
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
}

// Testable pure URL helpers; side effects only start on this page's normal load.
if(typeof document!=='undefined'&&document.querySelector('#app')){
  void startLauncher().catch(error=>{
    document.querySelector('#app').innerHTML=`<div class="loading-state"><h2>App failed to open</h2><p>${String(error?.message||error)}</p><a class="btn btn-secondary" href="${launcherUrl(location.href)}">Return to My Apps</a></div>`;
  });
}
