// Hello World als installierte Web-App: Oberfläche bleibt auch bei schwacher Verbindung
// sofort da (erst Netz, sonst gespeicherte Fassung). Daten (/api) und Apps immer frisch.
const SPEICHER = 'hello-world-oberflaeche-1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || /^\/(api|apps|muster)\b/.test(url.pathname)) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && r.type === 'basic') { const k = r.clone(); caches.open(SPEICHER).then((c) => c.put(e.request, k)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
});
