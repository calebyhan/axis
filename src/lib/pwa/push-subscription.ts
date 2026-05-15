export function pushSupported(publicKey: string): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!publicKey
  );
}

export function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return buffer;
}

export async function ensurePushRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}

export async function getOrCreatePushSubscription(publicKey: string): Promise<PushSubscription> {
  const registration = await ensurePushRegistration();
  const existingSubscription = await registration.pushManager.getSubscription();
  return (
    existingSubscription ??
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicKey),
    })
  );
}

export async function savePushSubscription(
  subscription: PushSubscription,
  { enable = true }: { enable?: boolean } = {}
): Promise<Response> {
  return fetch("/api/notifications/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      userAgent: navigator.userAgent,
      enable,
    }),
  });
}
