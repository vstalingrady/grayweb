/* eslint-disable no-restricted-globals */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {
    // Fallback: treat as text
    data = { title: "Gray Check-in", message: event.data.text() };
  }

  const title = data.title || "Gray Check-in";
  const message = data.message || "How are things going right now?";

  const options = {
    body: message,
    tag: data.tag || "gray-proactivity",
    requireInteraction: true,
    data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/g";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});

