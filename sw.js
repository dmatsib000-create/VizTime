// TimeFall service worker: the whole app is cached on first visit so it works offline.
const CACHE = 'timefall-paper-2';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js', './js/state.js', './js/ui.js', './js/setup.js', './js/session.js', './js/screens.js',
  './js/draw.js', './js/pip.js', './js/menu.js',
  './js/engine.js', './js/store.js', './js/sound.js', './js/faces.js', './js/float.js', './js/words.js',
  './js/platform.js', './js/cues.js', './js/native.js',
  './fonts/newsreader-roman.woff2', './fonts/newsreader-italic.woff2',
  './fonts/plex-mono-400.woff2', './fonts/plex-mono-500.woff2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
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
    // Only this app's old caches (under either of its names): other Pages projects share the origin.
    .then(keys => Promise.all(keys.filter(k => (k.startsWith('viztime') || k.startsWith('timefall')) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first so updates arrive when online; the saved copy answers when
// offline, when the network is slow, and when the server answers with an error.
// Every file is revalidated with the server ('no-cache'). Without that, GitHub
// Pages' 10-minute browser caching could pair a new index.html with an old
// app.js after a deploy, leaving new buttons with nothing wired to them.

// How long to wait for the network before answering from the saved copy. On
// weak Wi-Fi a request can hang far longer than this before failing.
const WAIT_MS = 3000;
// Only the app's own files are saved, each under its address without a query.
const key = url => { const u = new URL(url); return u.origin + u.pathname; };
const SAVED = new Set(SHELL.map(p => key(new URL(p, location))));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const fresh = new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' });
  const network = fetch(fresh);
  // Only a real copy of the file asked for is saved: never an error, and never
  // a redirect, which on clinic or hotel Wi-Fi can be its sign-in page. The
  // worker stays alive until it is saved, even when the saved copy answered first.
  e.waitUntil(network.then(res => {
    if (!res.ok || res.redirected || !SAVED.has(key(req.url))) return;
    const copy = res.clone();
    return caches.open(CACHE).then(c => c.put(key(req.url), copy));
  }).catch(() => {}));
  e.respondWith(answer(req, network));
});

async function answer(req, network) {
  const saved = async () => (await caches.match(key(req.url), { ignoreSearch: true }))
    || (req.mode === 'navigate' ? caches.match('./index.html') : undefined);
  let timer;
  const slow = new Promise(resolve => { timer = setTimeout(() => resolve('slow'), WAIT_MS); });
  const first = await Promise.race([network.catch(() => 'offline'), slow]);
  clearTimeout(timer);
  // A page may show a redirect (a Wi-Fi sign-in page is worth seeing); a
  // script, style or font that arrives by redirect is the wrong file.
  const good = res => res.ok && (!res.redirected || req.mode === 'navigate');
  if (first instanceof Response && good(first)) return first;
  const hit = await saved();
  if (hit) return hit;
  // Nothing saved: wait for the network after all, or pass on its answer.
  if (first === 'slow') return network.catch(() => Response.error());
  return first instanceof Response ? first : Response.error();
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
