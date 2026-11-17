const CACHE = "zunela-shell-v4";
const PRECACHE = [
  "/offline.html",
  "/logo-zunela.png",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // HTML siempre desde red cuando hay conexión (evita splash/login viejo oscuro).
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isShellAsset(url.pathname)) {
    event.respondWith(networkFirstAsset(request));
  }
});

function isShellAsset(pathname) {
  return (
    pathname === "/logo-zunela.png" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/offline.html" ||
    pathname === "/sw.js"
  );
}

async function networkFirstAsset(request) {
  try {
    const response = await fetch(request, { cache: "no-cache" });
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request, { cache: "no-cache" });
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    const offline = await caches.match("/offline.html");
    return offline || Response.error();
  }
}
