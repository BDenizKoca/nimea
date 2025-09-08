const CACHE_NAME = 'nimea-cache-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/en/index.html',
  '/css/style.css',
  '/manifest.webmanifest',
  '/js/search.js'
];

const MAP_ASSETS = [
  '/map/',
  '/map/index.html',
  '/en/map/index.html',
  '/map/style.css',
  '/map/map.webp',
  '/map/js/markers.js',
  '/map/js/ui.js',
  '/map/js/terrain.js',
  '/map/js/routing.js',
  '/map/js/routing/route-core.js',
  '/map/js/routing/route-ui.js',
  '/map/js/routing/route-share.js',
  '/map/js/routing/graph-builder.js',
  '/map/js/routing/pathfinding.js',
  '/map/js/routing/path-naturalizer.js',
  '/map/js/routing/visualizer.js',
  '/map/js/routing/terrain-utils.js',
  '/map/js/routing/waypoint-manager.js',
  '/map/js/routing/route-drag-drop.js',
  '/map/config.js',
  '/map/git-client.js',
  '/map/data/config.json',
  '/map/data/markers.json',
  '/map/data/terrain.geojson',
  '/overlays/regions.png',
  '/overlays/borders.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([...CORE_ASSETS, ...MAP_ASSETS].map(normalizeUrl))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Bypass for non-GET
  if (req.method !== 'GET') return;
  event.respondWith(networkFirst(req));
});

function normalizeUrl(u) {
  // Ensure we cache the built index for directories
  if (u.endsWith('/')) return u + 'index.html';
  return u;
}

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Offline fallback for document navigations
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/offline.html');
      if (fallback) return fallback;
    }
    throw e;
  }
}
