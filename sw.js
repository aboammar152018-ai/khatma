// ختمة: عامل الخدمة (التثبيت + العمل بدون إنترنت + الإشعارات)
const CACHE = 'khatma-v2';
const SB_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(['/', '/manifest.json', '/icon-192.png', '/badge-96.png']).catch(() => {});
    await c.add(new Request(SB_LIB, { mode: 'cors' })).catch(() => {});
  }));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// مكتبة الاتصال والخطوط: من النسخة المحفوظة أولاً (تكفي للعمل بدون إنترنت)
const isAsset = (u) => u.href === SB_LIB || u.host === 'fonts.googleapis.com' || u.host === 'fonts.gstatic.com';

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  if (isAsset(u)) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(r);
      if (hit) return hit;
      const res = await fetch(r);
      if (res.ok || res.type === 'opaque') c.put(r, res.clone());
      return res;
    }));
    return;
  }

  // الصفحة: من الإنترنت أولاً، ومن النسخة المحفوظة لو مفيش إنترنت
  if (r.mode === 'navigate' && u.origin === location.origin) {
    e.respondWith(
      fetch(r).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('/', copy));
        return res;
      }).catch(() => caches.match('/'))
    );
  }
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'ختمة', {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    dir: 'rtl',
    lang: 'ar',
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { await c.focus(); c.postMessage('refresh'); return; }
    }
    await self.clients.openWindow(e.notification.data.url || '/');
  })());
});
