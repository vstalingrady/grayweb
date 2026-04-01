"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
    useEffect(() => {
        if (!("serviceWorker" in navigator) || window.location.protocol !== "https:") {
            return;
        }

        let reloadHandled = false;
        const handleControllerChange = () => {
            if (reloadHandled) {
                return;
            }
            reloadHandled = true;
            const reloadGuardKey = "gray_sw_controllerchange_reload";
            try {
                if (sessionStorage.getItem(reloadGuardKey)) {
                    return;
                }
                sessionStorage.setItem(reloadGuardKey, "1");
            } catch {
                reloadHandled = true;
            }
            window.location.reload();
        };

        navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

        navigator.serviceWorker
            .register("/sw.js", { updateViaCache: "none" })
            .then(async (registration) => {
                console.log("Service Worker registered with scope:", registration.scope);
                await registration.update().catch(() => undefined);
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

        return () => {
            navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
        };
    }, []);

    return null;
}
