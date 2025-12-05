const CACHE_NAME = 'gray-cache-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // Only handle same-origin requests; let the browser deal with cross-origin
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    // Simple pass-through for now to enable PWA installability
    // We can add offline caching later if needed
    event.respondWith(
        (async () => {
            try {
                return await fetch(event.request);
            } catch (error) {
                // On network errors, fall back to a generic response instead of throwing
                return new Response('Network error while fetching resource.', {
                    status: 502,
                    statusText: 'Bad Gateway',
                });
            }
        })(),
    );
});
