// App shell is cached for offline study after the first successful online visit.
const CACHE = 'ciyan-shell-v8.15';
const ASSETS = ['./index.html','./launcher.js','./styles.css','./app.js','./reader-boundaries.js','./chapters/panlong-lexicon.js','./reader-core.js','./reader-ui.js','./reader-library.js','./speech-vault.js','./reader-guide.js','./reader-speech.js','./reader-cloud-speech.js','./chapter-download.js','./chapters/index.js','./collection-reset.js','./backup-versions.js','./study-engine.js','./study-progress.js','./tag-weights.js','./grammar-context.js','./context-matching.js','./review-scheduler.js','./particles.js','./particle-content.js','./learning-feedback.js','./tags.js','./drawing.js','./drawing-grades.js','./fonts.js','./font-library.js','./font-sources.js','./backup-integrity.js','./backup-restore.js','./fsrs.js','./storage.js',
  './cards.js','./grammar.js','./master-data.js','./master.js','./session-controls.js','./hsk-tag-map.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png',
  './icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(ASSETS.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})));
    // One-time v0.8.15 hotfix: replace the broken v0.8.14 navigation worker
    // promptly, including when a v0.8.14 launcher tab is still open.
    await self.skipWaiting();
  })());
});
self.addEventListener('message',event=>{if(event.data==='activate-update')event.waitUntil(self.skipWaiting());});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ciyan-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
// Safari rejects a navigation if the Response returned by a service worker
// has a redirect flag, even if the redirect ended with a successful HTML page.
// Constructing a fresh Response clears the internal response URL/redirect flags
// without changing the final bytes or headers.
function navigationResponse(response){
  return new Response(response.body, {
    status:response.status,
    statusText:response.statusText,
    headers:response.headers
  });
}
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    const scope=new URL(self.registration.scope);
    const index=new URL('./index.html',scope);
    const isShell=url.pathname===scope.pathname||url.pathname===index.pathname;
    event.respondWith((async()=>{
      // Both the launcher URL and ?app=ciyan use the same cached HTML offline.
      // Do not return a cached Response directly: Cloudflare's canonical URL
      // redirects can leave it marked "redirected" inside Safari/WebKit.
      const cached=await caches.match(isShell?index.href:event.request);
      const result=cached||await fetch(event.request);
      return navigationResponse(result);
    })());
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
