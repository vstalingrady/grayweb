self.addEventListener('install', () => {
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
            } catch {
                // On network errors, fall back to a generic response instead of throwing
                return new Response('Network error while fetching resource.', {
                    status: 502,
                    statusText: 'Bad Gateway',
                });
            }
        })(),
    );
});

self.addEventListener('push', (event) => {
    let data = {};
    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch {
        data = { title: 'Gray Check-in', message: event.data?.text?.() || '' };
    }

    const title = data.title || 'Gray Check-in';
    const message = data.message || 'How are things going right now?';
    const icon = data.icon || '/grayai.png';
    const badge = data.badge || '/grayai.png';

    const options = {
        body: message,
        icon,
        badge,
        tag: data.tag || 'gray-proactivity',
        requireInteraction: true,
        data,
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/g';

    event.waitUntil(
        clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if ('focus' in client) {
                        client.focus();
                        client.navigate(targetUrl);
                        return;
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
                return undefined;
            }),
    );
});
