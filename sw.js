// App shell is cached for offline study after the first successful online visit.
const CACHE = 'ciyan-shell-v1';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./fsrs.js','./storage.js',
  './cards.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png',
  './icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached=>cached || fetch(event.request)));
});
