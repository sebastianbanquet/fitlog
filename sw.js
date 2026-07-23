const CACHE_NAME = 'fitlog-v8';
const STATIC_ASSETS = [
  '/fitlog/',
  '/fitlog/index.html',
  '/fitlog/manifest.json',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,700;1,9..144,400&display=swap'
];

// ── Instalación: cachear assets estáticos ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Cache parcial:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activación: limpiar caches viejos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Cache First para assets, Network First para APIs ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // APIs externas (Anthropic, Google Sheets, Apps Script) → siempre red
  if (
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Sin conexión' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Assets propios → Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cachear respuestas válidas
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback → index.html
        if (event.request.destination === 'document') {
          return caches.match('/fitlog/index.html');
        }
      });
    })
  );
});

// ── Sync en background cuando recupera conexión ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-fitlog') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  // Los datos pendientes se manejan desde la app principal
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_READY' }));
}
