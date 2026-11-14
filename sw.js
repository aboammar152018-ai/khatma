// ختمة: عامل الخدمة (فتح سريع + العمل بدون إنترنت + الإشعارات)
const CACHE = 'khatma-v4';
const SB_LIB = '/supabase-2.117.3.js';
const TEXT = '/quran-text-v1.js';
const QCF_CACHE = 'khatma-qcf-v1'; // صفحات وخطوط مصحف المدينة (تُحفظ عشان تفتح بدون إنترنت)
const isQcf = (u) => u.host === 'cdn.jsdelivr.net' && u.pathname.startsWith('/npm/quran-qcf4@');

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(['/', '/manifest.json', '/icon-192.png', '/badge-96.png']).catch(() => {});
    await c.add(SB_LIB).catch(() => {});
  }));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== QCF_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// ملفات لا تتغير (المكتبة، الخطوط، نص المصحف): من النسخة المحفوظة دائماً
const isStatic = (u) => (u.origin === location.origin && u.pathname === SB_LIB) || u.host === 'fonts.googleapis.com' || u.host === 'fonts.gstatic.com'
  || (u.origin === location.origin && u.pathname === TEXT);

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  if (isQcf(u)) {
    e.respondWith(caches.open(QCF_CACHE).then(async (c) => {
      const hit = await c.match(r.url);
      if (hit) return hit;
      const res = await fetch(r);
      if (res.ok) c.put(r.url, res.clone());
      return res;
    }));
    return;
  }

  if (isStatic(u)) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(r);
      if (hit) return hit;
      const res = await fetch(r);
      if (res.ok || res.type === 'opaque') c.put(r, res.clone());
      return res;
    }));
    return;
  }

  // الصفحة: تفتح فوراً من النسخة المحفوظة، وتتحدث في الخلفية للمرة القادمة
  if (r.mode === 'navigate' && u.origin === location.origin && u.pathname !== '/privacy.html') {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match('/');
      const net = fetch(r).then((res) => { if (res.ok) c.put('/', res.clone()); return res; });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net.catch(() => caches.match('/'));
    }));
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
