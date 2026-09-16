/* LingoMitra service worker.
   App shell is precached and served cache-first (it is versioned by CACHE).
   Every path here is relative to this file, so the same worker serves the app
   from a domain root or from a subdirectory without edits.
   Course markdown is served stale-while-revalidate so a lesson you have read
   once opens instantly and offline, but still updates in the background. */

const SCOPE = self.registration.scope;
const PREFIX = 'lingomitra@' + SCOPE;
const CACHE = PREFIX + 'shell-v9';
const COURSE_CACHE = PREFIX + 'courses-v1';
const COURSE_BASE = new URL('courses/', SCOPE).href;

const SHELL = [
  './',
  'index.html',
  'styles.css?v=9',
  'script.js?v=9',
  'js/motion-fx.js',
  'js/content.js?v=8',
  'js/practice.js?v=8',
  'js/languages.js?v=8',
  'js/speech.js?v=8',
  'js/tutor.js',
  'js/coach.js?v=8',
  'vendor/vue.global.prod.js',
  'vendor/marked.umd.js',
  'vendor/motion.min.js',
  'fonts/inter-latin-opsz-normal.woff2',
  'fonts/inter-latin-ext-opsz-normal.woff2',
  'mascot.svg',
  'favicon.ico',
  'manifest.json?v=8',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'flags/de.svg',
  'flags/es.svg',
  'flags/fr.svg',
  'flags/hi.svg',
  'flags/zh.svg',
  'flags/jp.svg',
  'flags/kn.svg',
  'flags/ir.svg',
  'flags/ru.svg',
  'flags/it.svg',
  'flags/sa.svg',
  'flags/br.svg',
  'flags/kr.svg',
  'flags/tr.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // A partial shell must never replace a working offline installation.
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const courses = await caches.open(COURSE_CACHE);
    // Older releases mixed downloaded courses with the app shell. Migrate only
    // this installation's course URLs, without replacing a newer saved copy.
    for (const key of keys) {
      if (!/^lingomitra-v\d/.test(key) && !key.startsWith(PREFIX + 'shell-')) continue;
      const old = await caches.open(key);
      for (const request of await old.keys()) {
        if (request.url.startsWith(COURSE_BASE) && !(await courses.match(request))) {
          const response = await old.match(request);
          if (response) await courses.put(request, response);
        }
      }
    }
    // Never delete another application's caches, or a different installation.
    // Unscoped legacy caches can contain several installations, so retain them.
    await Promise.all(keys.filter(key => key.startsWith(PREFIX + 'shell-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;

  // Navigations: network first, with this installation's shell as fallback.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put('index.html', response.clone());
        return response;
      } catch (_) {
        return await cache.match('index.html') || await cache.match('./') ||
          new Response('The app is not available offline yet.', { status: 503 });
      }
    })());
    return;
  }

  // Keep the worker alive until revalidation finishes, including the cache write.
  if (url.href.startsWith(COURSE_BASE)) {
    const saved = caches.open(COURSE_CACHE).then(cache => cache.match(request));
    const update = fetch(request).then(async response => {
      if (response && response.ok) {
        const cache = await caches.open(COURSE_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    });
    event.waitUntil(update.catch(() => {}));
    event.respondWith(saved.then(cached => cached || update).catch(() =>
      new Response('Open this course online before using it offline.', { status: 503 })));
    return;
  }

  // Shell assets are cache first, scoped to this installation.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
