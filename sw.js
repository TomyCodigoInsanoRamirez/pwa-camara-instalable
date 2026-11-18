// Service Worker básico — estrategia Cache First (sin async/await)
const NOMBRE_CACHE = 'inspeccion-pwa-v1';

const ARCHIVOS_PRECACHE = [
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instalación: precachear el "app shell"
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(NOMBRE_CACHE)
      .then((cache) => cache.addAll(ARCHIVOS_PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activación: limpiar cachés antiguas y tomar control de las pestañas abiertas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres
          .filter((nombre) => nombre !== NOMBRE_CACHE)
          .map((nombre) => caches.delete(nombre))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: Cache First -> si está en caché responde de ahí, si no, va a la red
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((respuestaCache) => {
      if (respuestaCache) return respuestaCache;

      return fetch(event.request).catch(() => {
        // Sin red y sin caché: para navegaciones, devolver la página principal
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
