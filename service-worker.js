// service-worker.js

const CACHE_NAME = 'lingomitra-cache-v1'; // Increment if you make changes!
const GITHUB_BASE_PATH = ''; // CORRECTED: Set to empty string for root deployment

// App Shell: Core files needed for the app to run offline
// Now these paths will be relative to the root (e.g., /index.html, /styles.css)
const urlsToCache = [
  `${GITHUB_BASE_PATH}/`, // Will resolve to '/'
  `${GITHUB_BASE_PATH}/index.html`, // Will resolve to '/index.html'
  `${GITHUB_BASE_PATH}/styles.css`, // Will resolve to '/styles.css'
  `${GITHUB_BASE_PATH}/script.js`, // Will resolve to '/script.js'
  `${GITHUB_BASE_PATH}/mascot.svg`, // Will resolve to '/mascot.svg'
  `${GITHUB_BASE_PATH}/favicon.ico`, // Will resolve to '/favicon.ico'
  // External Libraries (These are absolute URLs, no change needed)
  'https://unpkg.com/vue@3/dist/vue.global.js',
  'https://cdnjs.cloudflare.com/ajax/libs/marked/4.0.2/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap',
  // Icons for the manifest (Paths relative to root)
  `${GITHUB_BASE_PATH}/icons/icon-192x192.png`, // Will resolve to '/icons/icon-192x192.png'
  `${GITHUB_BASE_PATH}/icons/icon-512x512.png`, // Will resolve to '/icons/icon-512x512.png'
  // Flag SVGs (Paths relative to root)
  `${GITHUB_BASE_PATH}/flags/de.svg`, // Will resolve to '/flags/de.svg'
  `${GITHUB_BASE_PATH}/flags/es.svg`, // etc.
  `${GITHUB_BASE_PATH}/flags/fr.svg`,
  `${GITHUB_BASE_PATH}/flags/hi.svg`,
  `${GITHUB_BASE_PATH}/flags/zh.svg`,
  `${GITHUB_BASE_PATH}/flags/jp.svg`,
  `${GITHUB_BASE_PATH}/flags/kn.svg`,
  // Add offline.html if you implemented it
  // `${GITHUB_BASE_PATH}/offline.html`,
];

// --- Install Event --- (No changes needed inside, paths are now fixed)
// ... (keep existing install logic) ...

// --- Activate Event --- (No changes needed inside)
// ... (keep existing activate logic) ...

// --- Fetch Event --- (Check paths if you added offline.html)
self.addEventListener('fetch', (event) => {
  // ... (existing fetch logic) ...

  // Make sure any hardcoded paths inside here are also root-relative
  // e.g., if using offline.html: return caches.match('/offline.html');

  if (event.request.method !== 'GET' || event.request.url.includes('/courses/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  const isNavigation = event.request.mode === 'navigate';

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok /* && your_caching_condition */) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(error => {
          console.error('[Service Worker] Fetch failed. URL:', event.request.url, error);
          if (isNavigation) {
            console.log('[Service Worker] Returning offline fallback page.');
            // CORRECTED path if using offline fallback
            return caches.match('/offline.html');
          }
          return undefined;
        });
      })
  );
});