'use strict';

const CACHE_NAME = 'controler-v1';

// Arquivos shell do app — sempre em cache
const SHELL = [
  '/',
  '/hub',
  '/chamados',
  '/obras',
  '/conforto',
  '/atividades',
  '/kpi',
  '/hub/hub.css',
  '/hub/hub.js',
  '/hub/auth.js',
  '/hub/api.js',
  '/chamados/chamados.css',
  '/chamados/chamados.js',
  '/obras/obras.css',
  '/obras/obras.js',
  '/conforto/conforto.css',
  '/conforto/conforto.js',
  '/atividades/atividades.css',
  '/atividades/atividades.js',
  '/kpi/kpi.css',
  '/kpi/kpi.js',
  '/admin/admin.css',
  '/admin/admin.js',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap'
];

// ── INSTALL: pré-carrega o shell ─────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpa caches antigos ───────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estratégia por tipo de recurso ────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // APIs → Network first, fallback para cache (dados offline)
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Fontes Google → Cache first (não mudam)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // Resto (HTML, CSS, JS) → Cache first, fallback network
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) {
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }))
      .catch(() => caches.match('/'))
  );
});

// ── PUSH NOTIFICATIONS ───────────────────────────────────────────────────────
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