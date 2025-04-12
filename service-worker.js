// service-worker.js

const CACHE_NAME = 'lingomitra-cache-v1'; // Increment version number when you update assets
const GITHUB_BASE_PATH = '/lingomitra-html'; // Your GitHub Pages sub-directory

// App Shell: Core files needed for the app to run offline
const urlsToCache = [
  `${GITHUB_BASE_PATH}/`, // The root index.html request for your path
  `${GITHUB_BASE_PATH}/index.html`,
  `${GITHUB_BASE_PATH}/styles.css`,
  `${GITHUB_BASE_PATH}/script.js`,
  `${GITHUB_BASE_PATH}/mascot.svg`,
  `${GITHUB_BASE_PATH}/favicon.ico`,
  // External Libraries (Ensure paths match your HTML)
  'https://unpkg.com/vue@3/dist/vue.global.js',
  'https://cdnjs.cloudflare.com/ajax/libs/marked/4.0.2/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  // Consider caching web fonts if critical (Font Awesome fonts are loaded by its CSS)
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap',
  // Icons for the manifest
  `${GITHUB_BASE_PATH}/icons/icon-192x192.png`,
  `${GITHUB_BASE_PATH}/icons/icon-512x512.png`,
  // Flag SVGs (add all you use) - Update this list!
  `${GITHUB_BASE_PATH}/flags/de.svg`,
  `${GITHUB_BASE_PATH}/flags/es.svg`,
  `${GITHUB_BASE_PATH}/flags/fr.svg`,
  `${GITHUB_BASE_PATH}/flags/hi.svg`, // Assuming 'hi' is the code for Hindi flag
  `${GITHUB_BASE_PATH}/flags/zh.svg`,
  `${GITHUB_BASE_PATH}/flags/jp.svg`,
  // Add any other essential assets like placeholder images etc.
  // Lesson content (.md files) are NOT cached here - they are fetched dynamically.
  // You could implement more complex caching for lessons later if needed.
];

// --- Install Event ---
// Cache the application shell files
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        // Use { cache: 'reload' } for external resources to bypass browser HTTP cache during install
        const cachePromises = urlsToCache.map(url => {
          const request = new Request(url, { cache: 'reload' });
          return fetch(request).then(response => {
            if (!response.ok) {
              // Handle potential 404s or errors for external resources gracefully
              // For example, Font Awesome CSS might load its own font files.
              // You might decide to log but not fail the entire install.
              console.warn(`[Service Worker] Failed to fetch ${url}. Status: ${response.status}`);
              // Don't put problematic responses into cache
              if (response.status === 404) return Promise.resolve(); // Silently skip 404s during install
            }
            return cache.put(request, response); // Cache successful responses
          }).catch(error => {
            console.error(`[Service Worker] Error fetching ${url}:`, error);
            // Don't fail install for single asset fetch error if not critical
            return Promise.resolve();
          });
        });
        return Promise.all(cachePromises);
      })
      .then(() => {
        console.log('[Service Worker] App shell cached successfully.');
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Caching failed:', error);
      })
  );
});

// --- Activate Event ---
// Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      // Take control of the page immediately
      return self.clients.claim();
    })
  );
});

// --- Fetch Event ---
// Serve cached content when offline (Cache-First Strategy for app shell)
self.addEventListener('fetch', (event) => {
  // Let browser handle requests for non-GET requests or specific paths (like course files for now)
  if (event.request.method !== 'GET' || event.request.url.includes('/courses/')) {
    // Allow dynamic fetching of lesson markdown files
    event.respondWith(fetch(event.request));
    return;
  }

  // For app shell resources (GET requests not for /courses/)
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // If found in cache, return it
        if (cachedResponse) {
          // console.log('[Service Worker] Returning from cache:', event.request.url);
          return cachedResponse;
        }

        // If not in cache, fetch from network
        // console.log('[Service Worker] Fetching from network:', event.request.url);
        return fetch(event.request).then((networkResponse) => {
          // Optional: Cache the newly fetched resource dynamically
          // Be careful not to cache error responses (like 404s) indefinitely
          if (networkResponse && networkResponse.ok && urlsToCache.includes(new URL(event.request.url).pathname)) {
            // Clone response as it can only be consumed once
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          return networkResponse; // Return the network response
        }).catch(error => {
          // Handle network errors (e.g., user is offline)
          console.error('[Service Worker] Fetch failed; returning offline page / error response (if available). URL:', event.request.url, error);
          // Optional: Return a fallback offline page/resource here if you create one
          // For now, it will just fail if offline and not cached.
          // return caches.match('/offline.html'); // Example fallback
        });
      })
  );
});