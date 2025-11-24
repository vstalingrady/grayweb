const CACHE_NAME = 'gray-cache-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Simple pass-through for now to enable PWA installability
    // We can add offline caching later if needed
    event.respondWith(fetch(event.request));
});
