// Ciyan standalone offline shell. AppLauncher supplies its own independent worker.
const CACHE='__SHELL_CACHE_NAME__';
const ASSETS=__PRECACHE_ASSETS__;
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(ASSETS.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})));
    // Replace obsolete workers without forcing a running study session to reload.
    await self.skipWaiting();
  })());
});
self.addEventListener('message',event=>{
  if(event.data==='activate-update')event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ciyan-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
// WebKit rejects redirect-tainted service-worker navigation responses, even
// after Cloudflare has successfully followed a canonical URL redirect.
function navigationResponse(response){
  return new Response(response.body,{
    status:response.status,statusText:response.statusText,headers:response.headers
  });
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    const scope=new URL(self.registration.scope);
    const index=new URL('./index.html',scope);
    const isShell=url.pathname===scope.pathname||url.pathname===index.pathname;
    event.respondWith((async()=>{
      const cached=await caches.match(isShell?index.href:event.request);
      const result=cached||await fetch(event.request);
      return navigationResponse(result);
    })());
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
