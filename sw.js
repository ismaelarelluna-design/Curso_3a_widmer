// Service Worker — App Curso 3A (Colegio Alberto Widmer)
const CACHE_NAME = 'cbs4-v7';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-widmer-192.png',
  '/icon-widmer-512.png',
  '/css/styles.css',
  '/js/core/firebase-init.js',
  '/js/core/utils.js',
  '/js/core/app.js',
  '/js/tabs/dashboard.js',
  '/js/tabs/curso.js',
  '/js/tabs/ingresos.js',
  '/js/tabs/cuotas.js',
  '/js/tabs/egresos.js',
  '/js/tabs/morosidad.js',
  '/js/tabs/votaciones.js',
  '/js/tabs/transparencia.js',
  '/js/tabs/movimientos.js',
  '/js/tabs/config.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js'
];

// Instalar y cachear recursos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activar y limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network first, cache fallback
self.addEventListener('fetch', e => {
  // Firebase y APIs siempre van a la red
  if (e.request.url.includes('firebase') || 
      e.request.url.includes('googleapis') ||
      e.request.url.includes('firebaseio')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
