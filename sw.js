// VizTime service worker: the whole app is cached on first visit so it works offline.
const CACHE = 'viztime-paper-8';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js', './js/state.js', './js/ui.js', './js/setup.js', './js/session.js', './js/screens.js',
  './js/draw.js', './js/pip.js', './js/menu.js',
  './js/engine.js', './js/store.js', './js/sound.js', './js/faces.js', './js/float.js', './js/words.js',
  './fonts/newsreader-roman.woff2', './fonts/newsreader-italic.woff2',
  './fonts/plex-mono-400.woff2', './fonts/plex-mono-500.woff2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // 'reload' skips the browser's own cache, so a new install never stores
  // files left over from the previous version.
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL.map(url => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    // Only this app's old caches: other Pages projects share the origin.
    .then(keys => Promise.all(keys.filter(k => k.startsWith('viztime') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first so updates arrive when online; the cache answers when offline.
// Every file is revalidated with the server ('no-cache'). Without that, GitHub
// Pages' 10-minute browser caching could pair a new index.html with an old
// app.js after a deploy, leaving new buttons with nothing wired to them.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const fresh = new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' });
  e.respondWith(fetch(fresh).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
