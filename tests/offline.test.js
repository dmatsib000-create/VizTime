// The service worker's file list: run with `node --test`. One missing file
// makes the install fail, and a file left off the list is missing offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const sw = readFileSync(new URL('sw.js', root), 'utf8');
const shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('every file in the offline list exists', () => {
  for (const path of shell) {
    const file = path === './' ? 'index.html' : path.slice(2);
    assert.ok(existsSync(new URL(file, root)), `${path} is listed in sw.js but missing`);
  }
});

test('every script and font is in the offline list', () => {
  const needed = [
    ...readdirSync(new URL('js/', root)).map(f => `./js/${f}`),
    ...readdirSync(new URL('fonts/', root)).filter(f => f.endsWith('.woff2')).map(f => `./fonts/${f}`),
    './index.html', './styles.css', './manifest.webmanifest',
  ];
  for (const path of needed) assert.ok(shell.includes(path), `${path} is not cached for offline use`);
});

/* ---------- How the worker answers (sw.js run with stand-ins) ---------- */

import vm from 'node:vm';

const SCOPE = 'https://example.github.io/VizTime/';
const strip = url => { const u = new URL(url, SCOPE); return u.origin + u.pathname; };

// Loads sw.js with a stand-in cache and network. `net(url)` answers each
// fetch; `saved` starts the cache with copies of some files.
function worker(net, saved = {}) {
  const store = new Map(Object.entries(saved).map(([p, body]) => [strip(p), new Response(body)]));
  const handlers = {};
  const cache = { put: async (k, res) => { store.set(strip(k), res); }, addAll: async () => {} };
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    location: new URL('sw.js', SCOPE),
    caches: {
      open: async () => cache,
      match: async k => store.get(strip(k))?.clone(),
      keys: async () => [], delete: async () => true,
    },
    fetch: async req => net(req.url),
    Request, Response, URL, Set, Promise,
    setTimeout: fn => setTimeout(fn, 20), clearTimeout,
  };
  self.self = self;
  vm.runInNewContext(sw, self);
  // Dispatches a fetch and resolves its answer, once any saving has finished.
  const get = async (path, mode = 'cors') => {
    let answer; const waits = [];
    handlers.fetch({ request: { method: 'GET', url: new URL(path, SCOPE).href, mode }, respondWith: p => { answer = p; }, waitUntil: p => waits.push(p) });
    const res = await answer;
    await Promise.all(waits);
    return res;
  };
  return { get, store };
}
const body = async res => (res.type === 'error' ? 'network error' : res.text());
const redirect = text => { const r = new Response(text); Object.defineProperty(r, 'redirected', { value: true }); return r; };

test('online: the fresh file answers and an app file is saved', async () => {
  const w = worker(() => new Response('new app'));
  assert.equal(await body(await w.get('js/app.js')), 'new app');
  assert.ok(w.store.has(strip('js/app.js')));
  // A file that isn't the app's is passed on but not kept.
  assert.equal(await body(await w.get('install/index.html')), 'new app');
  assert.equal(w.store.has(strip('install/index.html')), false);
});

test('a redirect (a Wi-Fi sign-in page) is never saved, and never answers for a script', async () => {
  const w = worker(() => redirect('<html>Sign in to Wi-Fi</html>'), { 'js/app.js': 'saved app' });
  assert.equal(await body(await w.get('js/app.js')), 'saved app');
  assert.equal(await body(w.store.get(strip('js/app.js')).clone()), 'saved app');
  // A page may show it, so the person can sign in.
  assert.equal(await body(await w.get('./', 'navigate')), '<html>Sign in to Wi-Fi</html>');
});

test('a server error is answered from the saved copy when there is one', async () => {
  const w = worker(() => new Response('Service unavailable', { status: 503 }), { 'styles.css': 'saved styles' });
  assert.equal(await body(await w.get('styles.css')), 'saved styles');
  assert.equal(await body(w.store.get(strip('styles.css')).clone()), 'saved styles');
  // Nothing saved: the error is passed on as it is.
  assert.equal((await w.get('js/words.js')).status, 503);
});

test('a slow network gives way to the saved copy; with nothing saved, it is waited for', async () => {
  const later = text => new Promise(resolve => setTimeout(() => resolve(new Response(text)), 100));
  const w = worker(() => later('fresh'), { 'js/engine.js': 'saved engine' });
  assert.equal(await body(await w.get('js/engine.js')), 'saved engine');
  // The fresh copy still replaces the saved one for next time.
  assert.equal(await body(w.store.get(strip('js/engine.js')).clone()), 'fresh');
  assert.equal(await body(await w.get('js/cues.js')), 'fresh');
});

test('offline: the saved copy answers, and any page opens the app', async () => {
  const w = worker(() => { throw new TypeError('offline'); }, { 'js/app.js': 'saved app', './index.html': 'saved page' });
  assert.equal(await body(await w.get('js/app.js?v=2')), 'saved app');
  assert.equal(await body(await w.get('somewhere/else', 'navigate')), 'saved page');
  assert.equal(await body(await w.get('js/missing.js')), 'network error');
});
