'use strict';
const CACHE_NAME = 'controler-v5';

const SHELL = [
  '/',
  '/hub/hub.html',
  '/hub/hub.css',
  '/hub/hub.js',
  '/hub/auth.js',
  '/hub/api.js',
  '/hub/cache.js',
  '/chamados/chamados.html',
  '/chamados/chamados.css',
  '/obras/obras.html',
  '/obras/obras.css',
  '/conforto/conforto.html',
  '/conforto/conforto.css',
  '/atividades/atividades.html',
  '/kpi/kpi.html',
  '/kpi/kpi.css',
  '/kpi/kpi.js',
];
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
 if (url.pathname.startsWith('/api/')) {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request.url, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request.url))
  );
  return;
}
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        return res;
      }))
    );
    return;
  }
  e.respondWith(
  caches.match(e.request)
    .then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
    .catch(() => caches.match('/'))
);
});
self.addEventListener('push', e => {
  let data = { title: 'Controler', body: 'Nova notificação', icon: '/icons/icon-192.png' };
  try { data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    data.icon || '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      data:    { url: data.url || '/' },
      actions: data.actions || []
    })
  );
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(target) && 'focus' in c);
      return existing ? existing.focus() : clients.openWindow(target);
    })
  );
});