// Hors ligne (version web) : tout le jeu est mis en cache dès la première visite.
// La liste des fichiers et la version sont écrites ici par vite.config.ts au moment du build.
const BUILD = /*__BUILD__*/ { version: 'dev', files: ['./', './index.html', './manifest.webmanifest', './icon.svg'] };
const CACHE = `lexicode-${BUILD.version}`;
const scope = new URL('./', self.location.href);
const INDEX = new URL('./index.html', scope).href;
const ASSETS = new URL('./assets/', scope).href;
const PRECACHED = new Set(BUILD.files.map((f) => new URL(f, scope).href));
const NAV_TIMEOUT = 3000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([...PRECACHED])).then(() => self.skipWaiting()));
});

// Nouvelle version : on retire les anciens caches et, dans le cache courant, ce qui n'est plus dans la liste.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('lexicode-')) await caches.delete(k);
      const c = await caches.open(CACHE);
      for (const req of await c.keys()) if (!PRECACHED.has(req.url) && !req.url.startsWith(ASSETS)) await c.delete(req);
      await self.clients.claim();
    })(),
  );
});

async function put(req, res) {
  if (!res.ok || res.type !== 'basic') return;
  const c = await caches.open(CACHE);
  await c.put(req, res);
}

// Fichiers du build (noms hachés, donc immuables) : le cache d'abord.
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  void put(req, res.clone());
  return res;
}

// Navigation : le réseau d'abord, avec un délai ; index.html en cache sinon.
async function navigate(req) {
  const path = req.url.split(/[?#]/)[0];
  const net = fetch(req).then((res) => {
    if (path === scope.href || path === INDEX) void put(INDEX, res.clone());
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT));
  const first = await Promise.race([net.catch(() => null), timeout]);
  if (first) return first;
  const cached = await caches.match(INDEX);
  if (cached) return cached;
  return net;
}

// Autres fichiers de la liste (manifeste, icônes) : le réseau d'abord, le cache en secours.
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    void put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(scope.href)) return;
  if (req.mode === 'navigate') e.respondWith(navigate(req));
  else if (req.url.startsWith(ASSETS)) e.respondWith(cacheFirst(req));
  else if (PRECACHED.has(req.url)) e.respondWith(networkFirst(req));
});
