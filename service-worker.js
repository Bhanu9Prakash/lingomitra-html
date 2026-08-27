/* LingoMitra service worker.
   App shell is precached and served cache-first (it is versioned by CACHE).
   Course markdown is served stale-while-revalidate so a lesson you have read
   once opens instantly and offline, but still updates in the background. */

const CACHE = 'lingomitra-v5';

const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/js/motion-fx.js',
  '/js/content.js',
  '/js/practice.js',
  '/js/speech.js',
  '/vendor/vue.global.prod.js',
  '/vendor/marked.umd.js',
  '/vendor/motion.min.js',
  '/fonts/inter-latin-opsz-normal.woff2',
  '/fonts/inter-latin-ext-opsz-normal.woff2',
  '/mascot.svg',
  '/favicon.ico',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/flags/de.svg',
  '/flags/es.svg',
  '/flags/fr.svg',
  '/flags/hi.svg',
  '/flags/zh.svg',
  '/flags/jp.svg',
  '/flags/kn.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll is all-or-nothing; add individually so one 404 cannot abort install.
      .then((cache) => Promise.all(
        SHELL.map((url) => cache.add(url).catch(() => { /* skip */ }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // fonts etc. use the HTTP cache

  // Navigations: network first so a deploy is picked up, shell as the fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Course files: stale-while-revalidate.
  if (url.pathname.includes('/courses/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Everything else: cache first, fall back to network and store the result.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
