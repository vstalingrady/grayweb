"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
    useEffect(() => {
        if ("serviceWorker" in navigator && window.location.protocol === "https:") {
            navigator.serviceWorker
                .register("/sw.js")
                .then(async (registration) => {
                    console.log("Service Worker registered with scope:", registration.scope);
                    try {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        await Promise.all(
                            registrations
                                .filter((entry) => entry.active?.scriptURL?.includes("/sw-proactivity.js"))
                                .map((entry) => entry.unregister())
                        );
                    } catch (cleanupError) {
                        console.warn("Failed to cleanup legacy service workers:", cleanupError);
                    }
                })
                .catch((error) => {
                    console.error("Service Worker registration failed:", error);
                });
        }
    }, []);

    return null;
}
