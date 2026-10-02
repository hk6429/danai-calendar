// 改 data/js/css 必升 VERSION。shell/data：cache-first 後台更新（stale-while-revalidate）；img：cache-first，失敗回 fallback。
// 頁面每次啟動 postMessage {type:'prefetch', urls} 預抓今日 ±7 天場景圖。
const VERSION = 'dc-v2', MEDIA = 'dc-media';
const SHELL = ['./', 'css/app.css', 'js/app.js', 'js/calendar.js', 'js/quote.js', 'js/scene.js', 'js/particles.js', 'js/vendor/lunar.js', 'data/quotes.json', 'data/holidays.json', 'img/fallback.webp', 'manifest.webmanifest'];
self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(VERSION);
  await c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));
  await self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== VERSION && k !== MEDIA) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('message', e => {
  if (e.data?.type !== 'prefetch') return;
  e.waitUntil(caches.open(MEDIA).then(async m => {
    for (const u of e.data.urls) if (!(await m.match(u))) await fetch(u).then(r => { if (r.ok) return m.put(u, r); }).catch(() => {});
  }));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url); if (url.origin !== location.origin || e.request.method !== 'GET') return;
  if (url.pathname.includes('/img/')) {
    e.respondWith((async () => {
      const m = await caches.open(MEDIA); const hit = await m.match(e.request); if (hit) return hit;
      try { const r = await fetch(e.request); if (r.ok) m.put(e.request, r.clone()); return r; }
      catch { return (await caches.match('img/fallback.webp')) || Response.error(); }
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const cached = await c.match(e.request) || (e.request.mode === 'navigate' ? await c.match('./') : null);
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    const r = await net; return r || Response.error();
  })());
});
