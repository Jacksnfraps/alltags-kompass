// Offline shell. Network-first for app files (updates arrive immediately when the server is reachable),
// cache fallback when offline. API calls are never cached.
const CACHE = 'kompass-shell-v10';
const SHELL = ['./','./index.html','./src/styles.css','./src/app.js','./src/main.js','./src/ui.js',
  './src/views/inbox.js','./src/views/ideas.js','./src/views/todos.js','./src/views/events.js','./src/views/meds.js',
  './src/domain/sort.js','./src/domain/when.js','./src/domain/ics.js','./src/domain/intent.js','./src/domain/shifts.js','./src/domain/id.js','./src/domain/state.js',
  './src/data/capture-flow.js','./src/data/store.js','./src/data/cloud.js','./src/data/sync.js',
  './manifest.webmanifest','./icon.svg','./icon-180.png','./icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('kompass-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  const inShell = SHELL.some(path => new URL(path, self.registration.scope).href === url.href);
  if (!inShell) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request, {cache: 'no-cache', signal: AbortSignal.timeout(4000)});
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    } catch {
      return (await cache.match(event.request)) || (await cache.match('./index.html')) || Response.error();
    }
  })());
});
