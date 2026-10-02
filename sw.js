// 改 data/js/css 必升 VERSION。shell network-first 回退快取；img cache-first；啟用時預抓今日 ±7 天場景圖。
const VERSION = 'dc-v1', MEDIA = 'dc-media';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/calendar.js', 'js/quote.js', 'js/scene.js', 'js/particles.js', 'js/vendor/lunar.js', 'data/quotes.json', 'data/holidays.json', 'img/fallback.webp', 'manifest.webmanifest'];
const doy = d => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 864e5) + 1;
const scene = n => `img/d${String(Math.min(Math.max(n, 1), 365)).padStart(3, '0')}.webp`;
self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(VERSION); await c.addAll(SHELL); await self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== VERSION && k !== MEDIA) await caches.delete(k);
  await self.clients.claim();
  const m = await caches.open(MEDIA); const now = new Date();
  for (let o = -7; o <= 7; o++) {
    const u = scene(doy(new Date(now.getFullYear(), now.getMonth(), now.getDate() + o)));
    if (!(await m.match(u))) fetch(u).then(r => { if (r.ok) m.put(u, r); }).catch(() => {});
  }
})()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url); if (url.origin !== location.origin || e.request.method !== 'GET') return;
  if (url.pathname.includes('/img/')) {
    e.respondWith(caches.open(MEDIA).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }
    catch { return (await c.match(e.request)) || (await c.match('./')); }
  })());
});
