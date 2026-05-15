"use client";

import { useEffect } from "react";
import { getOrCreatePushSubscription, pushSupported, savePushSubscription } from "@/lib/pwa/push-subscription";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";

    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .then(async () => {
        if (!pushSupported(publicKey) || Notification.permission !== "granted") return;

        const subscription = await getOrCreatePushSubscription(publicKey);
        const response = await savePushSubscription(subscription, { enable: false });
        if (!response.ok) {
          console.warn("[PWA] Push subscription refresh failed", response.status);
        }
      })
      .catch((error) => {
        console.error("[PWA] Service worker registration failed", error);
      });
  }, []);

  return null;
}
