/* ==========================================================
   Coding Hub - the service worker.

   Keeps working when the server cannot be reached:
     - every screen already visited stays readable
     - lessons, subjects and progress from the last visit are shown
   Anything that changes data waits for the server to come back.

   Private conversations are never cached, and everything cached
   is wiped when you sign out.
   ========================================================== */

const VERSION = 'codinghub-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;

/* Every file needed to run the app with no connection. */
const SHELL = [
  '/', '/index.html', '/favicon.svg', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-64.png',

  '/styles/base.css', '/styles/layout.css', '/styles/components.css',
  '/styles/pages.css', '/styles/learn.css', '/styles/neon.css', '/styles/celebrate.css',

  '/js/app.js', '/js/update-guard.js',
  '/js/lib/api.js', '/js/lib/dom.js', '/js/lib/icons.js', '/js/lib/router.js',
  '/js/lib/store.js', '/js/lib/ui.js', '/js/lib/offline.js', '/js/lib/celebrate.js',
  '/js/components/shell.js', '/js/components/common.js', '/js/components/post-card.js',
  '/js/components/learn.js',

  '/js/views/auth.js', '/js/views/home.js', '/js/views/messages.js',
  '/js/views/subjects.js', '/js/views/topic.js', '/js/views/lesson.js',
  '/js/views/practice.js', '/js/views/challenges.js', '/js/views/progress.js',
  '/js/views/history.js', '/js/views/bookmarks.js', '/js/views/achievements.js',
  '/js/views/leaderboard.js', '/js/views/members.js', '/js/views/search.js',
  '/js/views/profile.js', '/js/views/announcements.js', '/js/views/notifications.js',
  '/js/views/settings.js', '/js/views/admin.js', '/js/views/admin-curriculum.js'
];

/**
 * Read-only endpoints whose last answer is worth keeping so the app
 * still shows something useful with no connection.
 * Private conversations are deliberately NOT in this list.
 */
const CACHEABLE_API = [
  '/api/auth/me', '/api/auth/config', '/api/dashboard',
  '/api/announcements', '/api/users', '/api/notifications',
  '/api/learn/overview', '/api/learn/subjects', '/api/learn/progress'
];

const isCacheableApi = (pathname) =>
  CACHEABLE_API.some((p) => pathname === p || pathname.startsWith(`${p}?`) || pathname.startsWith(`${p}/`));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // One missing file must not fail the whole install.
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
  // Signing out clears every trace of the class data from this device.
  if (event.data === 'clear-data') event.waitUntil(caches.delete(DATA_CACHE));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The live connection and uploaded pictures always go straight to the server.
  if (url.pathname.startsWith('/socket.io/') || url.pathname.startsWith('/uploads/')) return;

  // ---- API: fresh when online, last saved copy when not ----
  if (url.pathname.startsWith('/api/')) {
    if (!isCacheableApi(url.pathname)) return;
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(DATA_CACHE);
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch {
        const cached = await (await caches.open(DATA_CACHE)).match(request);
        if (cached) {
          // Tell the app this is a saved copy so it can say so on screen.
          const headers = new Headers(cached.headers);
          headers.set('X-Grade8-Offline', 'cached');
          return new Response(await cached.blob(), { status: 200, headers });
        }
        return new Response(
          JSON.stringify({ error: 'You are offline and this has not been saved on this device yet.', code: 'offline' }),
          { status: 503, headers: { 'Content-Type': 'application/json', 'X-Grade8-Offline': 'miss' } }
        );
      }
    })());
    return;
  }

  // ---- Page loads ----
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('/index.html')) || (await cache.match('/')) || offlinePage();
      }
    })());
    return;
  }

  // ---- Scripts, styles, icons ----
  // The server wins whenever it can be reached, and the cached copy is
  // only used when it cannot. Serving code from the cache first meant the
  // first launch after an update ran the PREVIOUS version's JavaScript,
  // so new screens appeared to be missing until the page was reloaded.
  // These files are tiny and served from the same computer or the local
  // network, so going to the server first costs almost nothing.
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      // Offline: fall back to the last copy saved on this device.
      const cached = await cache.match(request);
      return cached || new Response('', { status: 504 });
    }
  })());
});

function offlinePage() {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Coding Hub - offline</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080a13;color:#eef1fb;
       font-family:'Segoe UI',system-ui,sans-serif;text-align:center;padding:2rem}
  .mark{width:76px;height:76px;border-radius:22px;margin:0 auto 1.2rem;display:grid;place-items:center;
        background:linear-gradient(135deg,#7c5cff,#22d3ee);color:#0b0d17;font-weight:800;font-size:1.6rem}
  p{color:#a2abcc;max-width:34ch;margin:0 auto 1.4rem}
  button{background:#7c5cff;color:#fff;border:0;border-radius:10px;padding:.8rem 1.4rem;
         font:inherit;font-weight:600;cursor:pointer}
</style></head>
<body><div>
  <div class="mark">&lt;/&gt;</div>
  <h1>You are offline</h1>
  <p>The Coding Hub needs a connection to its server. Check your network, then try again.</p>
  <button onclick="location.reload()">Try again</button>
</div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
