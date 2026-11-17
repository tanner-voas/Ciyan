// App shell is cached for offline study after the first successful online visit.
const CACHE = 'ciyan-shell-v5';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./study-engine.js','./review-scheduler.js','./particles.js','./tags.js','./drawing.js','./fsrs.js','./storage.js',
  './cards.js','./grammar.js','./master-data.js','./master.js','./session-controls.js','./hsk-tag-map.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png',
  './icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(ASSETS);
  })()); // Activate once existing app windows close; avoid mixing JS releases mid-session.
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ciyan-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached=>cached || fetch(event.request)));
});
