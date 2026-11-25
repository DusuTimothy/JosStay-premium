/* JosStay service worker
 *
 * Only same-origin static build assets and app icons are cached. HTML,
 * Next.js data requests, API calls, authentication, bookings, payments,
 * refunds, and payouts always go to the network so private or money-related
 * state is never served from a shared cache.
 */

const CACHE_NAME = "josstay-static-v1";
const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icon.png",
];

const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  url.pathname === "/icon.png" ||
  url.pathname === "/favicon.ico" ||
  url.pathname === "/manifest.webmanifest";

const offlineResponse = () =>
  new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>You're offline — JosStay</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #F7F6F3;
        color: #26242E;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      main {
        width: min(420px, 100%);
        border: 1px solid #E7E4E0;
        border-radius: 20px;
        background: #fff;
        padding: 28px;
        text-align: center;
        box-shadow: 0 18px 40px -16px rgba(38, 36, 46, .22);
      }
      img { width: 64px; height: 64px; margin: 0 auto 16px; display: block; }
      h1 { margin: 0; font-size: 24px; letter-spacing: -.03em; }
      p { margin: 10px 0 0; color: #6E6A76; font-size: 14px; line-height: 1.6; }
      button {
        margin-top: 20px;
        height: 44px;
        padding: 0 20px;
        border: 0;
        border-radius: 10px;
        background: #E1B752;
        color: #26242E;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <main>
      <img src="/icons/icon-192.png" alt="" />
      <h1>You're offline</h1>
      <p>JosStay needs a connection to load bookings, availability, and payments. Reconnect and try again.</p>
      <button type="button" onclick="location.reload()">Try again</button>
    </main>
  </body>
</html>`,
    {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API responses, auth, payments, or Next.js RSC/data requests.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => offlineResponse()));
    return;
  }

  if (!isStaticAsset(url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    }),
  );
});
