/// <reference lib="webworker" />

const CACHE_VERSION = "axis-pwa-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const STATIC_ASSETS = [
  "/manifest.json",
  "/offline.html",
  "/logo.svg",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

const SAME_ORIGIN = self.location.origin;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== SAME_ORIGIN) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (isNavigationLikeRequest(request, url)) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (isCacheableDataRequest(request, url)) {
    event.respondWith(networkFirstJson(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_AXIS_CACHE") return;

  event.waitUntil(
    deleteAxisCaches().then(() => {
      event.source?.postMessage({ type: "AXIS_CACHE_CLEARED" });
    })
  );
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  if (!payload) return;

  const title = payload.title || "Axis";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body,
      icon: payload.icon || "/icons/icon-192.svg",
      badge: payload.badge || "/icons/icon-192.svg",
      tag: payload.tag,
      data: {
        url: payload.url || "/dashboard",
      },
      timestamp: payload.timestamp || Date.now(),
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === targetUrl);
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});

function readPushPayload(event) {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch {
    return {
      title: "Axis",
      body: event.data.text(),
      url: "/dashboard",
    };
  }
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/logo.svg" ||
    url.pathname === "/offline.html"
  );
}

function isNavigationLikeRequest(request, url) {
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/auth/")) return false;
  if (url.pathname.startsWith("/_next/image")) return false;
  if (url.pathname === "/sw.js") return false;

  return (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html") ||
    request.headers.get("rsc") === "1" ||
    url.searchParams.has("_rsc")
  );
}

function isCacheableDataRequest(request, url) {
  if (request.headers.get("accept")?.includes("text/html")) return false;

  return (
    url.pathname.startsWith("/api/strava/streams/") ||
    url.pathname === "/api/strava/zones"
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheable(response)) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstJson(request) {
  const cache = await caches.open(DATA_CACHE);

  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return Response.error();
  }
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === "navigate") {
      return caches.match("/offline.html");
    }

    return Response.error();
  }
}

function isCacheable(response) {
  return response && response.ok && response.status === 200 && response.type === "basic";
}

async function deleteAxisCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith("axis-pwa-"))
      .map((key) => caches.delete(key))
  );
}
