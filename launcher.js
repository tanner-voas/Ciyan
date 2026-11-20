// v0.8.15: one installed PWA, independently loaded app runtimes.
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
  const tiles=APPS.map(app=>`<a class="launcher-tile" data-launch-app="${app.id}" href="${appLaunchUrl(current,app.id)}" aria-label="Open ${app.name}"><span class="launcher-tile-icon" aria-hidden="true">${app.glyph}</span><span class="launcher-tile-name">${app.name}</span><span class="launcher-tile-description">${app.description}</span></a>`).join('');
  return `<div class="launcher-screen"><header class="launcher-header"><span class="launcher-eyebrow">YOUR WORKSPACE</span><div class="launcher-monogram" aria-hidden="true">M</div></header>
    <h1 class="launcher-title">My Apps</h1><p class="launcher-subtitle">Your apps, in one place.</p>
    <section class="launcher-section" aria-labelledby="launcher-apps-heading"><div class="launcher-section-heading"><h2 id="launcher-apps-heading">Installed apps</h2><span>${APPS.length} ${APPS.length===1?'app':'apps'}</span></div>
    <div class="launcher-grid">${tiles}</div></section></div>`;
}

// Launch inside this document. iOS Home Screen PWAs can hand a normal <a>
// navigation to Safari even when its destination is in the manifest scope.
// No Cíyán code runs on the Home Screen until this explicit selection.
let launching=false;
export async function launchApp(id){
  const selected=APPS.find(app=>app.id===id);
  if(!selected||launching)return;
  launching=true;
  const previous=location.href;
  try{
    history.replaceState(null,'',appLaunchUrl(previous,id));
    document.title='Cíyán v0.8.15';
    document.body.classList.remove('launcher-mode');
    document.querySelector('#app').innerHTML='<div class="loading-state"><div class="brand-mark">词</div><div class="loading-spinner"></div><p>Opening Cíyán…</p></div>';
    // App boot is the same module as before the launcher was introduced.
    await import(selected.module);
  }catch(error){
    history.replaceState(null,'',launcherUrl(previous));
    document.body.classList.add('launcher-mode');
    document.title='My Apps';
    document.querySelector('#app').innerHTML=homeScreen(location.href);
    throw error;
  }finally{
    launching=false;
  }
}

export async function startLauncher(){
  const id=activeAppId(location.href);
  if(id==='ciyan'){
    document.title='Cíyán v0.8.15';
    await import('./app.js');
    return;
  }
  document.title='My Apps';
  document.body.classList.add('launcher-mode');
  const host=document.querySelector('#app');
  host.innerHTML=homeScreen(location.href);
  host.addEventListener('click',event=>{
    const tile=event.target.closest?.('[data-launch-app]');
    if(!tile||event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    void launchApp(tile.dataset.launchApp).catch(error=>{
      const message=document.createElement('p');
      message.className='subtle launcher-error';
      message.textContent=`Unable to open app: ${error?.message||error}`;
      host.querySelector('.launcher-section')?.append(message);
    });
  });
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    const worker=navigator.serviceWorker;
    // On the safe Home Screen, reload once if an update assumes control so the
    // new launcher code is loaded as well as the newly cached app files.
    worker.addEventListener('controllerchange',()=>{
      if(!activeAppId(location.href))location.reload();
    },{once:true});
    worker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});
  }
}

// Testable pure URL helpers; side effects only start on this page's normal load.
if(typeof document!=='undefined'&&document.querySelector('#app')){
  void startLauncher().catch(error=>{
    document.querySelector('#app').innerHTML=`<div class="loading-state"><h2>App failed to open</h2><p>${String(error?.message||error)}</p><a class="btn btn-secondary" href="${launcherUrl(location.href)}">Return to My Apps</a></div>`;
  });
}
