// Sonyria — service worker : ouverture rapide même avec un réseau cellulaire faible, utilisable hors ligne (sauf IA)
const CACHE = 'sonyria-v44';
const CORE = ['/', '/manifest.webmanifest', '/logo.png', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
const put = (req, r) => { if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)).catch(() => {}); } return r; };
// réseau d'abord, mais jamais plus de « ms » : sinon la copie en cache
const netFirst = (req, ms) => new Promise((resolve) => {
  let done = false;
  const fallback = () => caches.match(req).then((m) => m || caches.match('/'));
  const t = setTimeout(() => { fallback().then((m) => { if (!done && m) { done = true; resolve(m); } }); }, ms);
  fetch(req).then((r) => { put(req, r); if (!done) { done = true; clearTimeout(t); resolve(r); } })
    .catch(() => { clearTimeout(t); fallback().then((m) => { if (!done) { done = true; resolve(m || Response.error()); } }); });
});
// cache d'abord pour les fichiers qui ne changent jamais (noms avec empreinte, sons, images)
const cacheFirst = (req) => caches.match(req).then((m) => m || fetch(req).then((r) => put(req, r)));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;
  if (u.origin !== location.origin) { if (u.hostname.includes('fonts.')) e.respondWith(cacheFirst(e.request).catch(() => Response.error())); return; }
  if (u.pathname.startsWith('/_next/static/') || /\.(png|webp|jpg|svg|m4a|mp3|json|woff2?)$/.test(u.pathname)) { e.respondWith(cacheFirst(e.request).catch(() => fetch(e.request))); return; }
  e.respondWith(netFirst(e.request, 3500));
});
