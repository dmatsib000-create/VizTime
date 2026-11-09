// Loads the real page in headless Chrome, in each mode, and fails on any
// script error. The unit tests import only the pure modules, so a mistake in a
// page module (a broken import, a top-level error, a call with the wrong
// arguments) would otherwise pass CI and stop the app loading.
//
// No dependencies: Node's own http server serves the files, and Chrome is
// driven over its DevTools protocol with Node's built-in WebSocket (Node 22).
// Run it with `node tests/browser-smoke.mjs`; CHROME names the browser if
// `google-chrome` isn't on the path. CI runs it after the unit tests.

import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const MIN = 60_000;

// The site as GitHub Pages serves it: from a subpath, like /VizTime/.
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!path.startsWith('/VizTime/')) { res.writeHead(404).end(); return; }
  let file = normalize(path.slice('/VizTime/'.length) || 'index.html');
  if (file.endsWith('/')) file += 'index.html';
  if (file.startsWith('..')) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/VizTime/`;

// Chrome, with a page target to drive.
const profile = await mkdtemp(join(tmpdir(), 'timefall-smoke-'));
const chrome = spawn(process.env.CHROME || 'google-chrome', [
  '--headless=new', '--no-sandbox', '--no-first-run', '--disable-gpu', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const browserWs = await new Promise((resolve, reject) => {
  let err = '';
  chrome.stderr.on('data', d => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) resolve(m[1]); });
  chrome.on('exit', code => reject(new Error(`Chrome exited (${code}) before it was ready:\n${err}`)));
  setTimeout(() => reject(new Error(`Chrome did not start:\n${err}`)), 20_000);
});
const port = new URL(browserWs).port;
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let nextId = 1;
const waiting = new Map();
const problems = [];
ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); return; }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    problems.push(`${d.exception?.description || d.text} (${d.url || ''}:${d.lineNumber})`);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    problems.push(`console.error: ${msg.params.args.map(a => a.value ?? a.description).join(' ')}`);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  waiting.set(id, msg => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`${expression}: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
  return r.result.value;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

await send('Runtime.enable');
await send('Page.enable');

// Opens the page with this saved data, and waits for the first screen.
async function open(data) {
  await send('Page.navigate', { url: BASE });
  await sleep(300);
  await evaluate(`localStorage.clear(); ${Object.entries(data).map(([k, v]) => `localStorage.setItem('viztime2:${k}', ${JSON.stringify(JSON.stringify(v))});`).join(' ')} true`);
  problems.length = 0;
  await send('Page.reload', { ignoreCache: true });
  for (let i = 0; i < 100; i++) {
    await sleep(100);
    const ready = await evaluate('document.readyState === "complete" && !!document.body.dataset.screen').catch(() => false);
    if (ready) break;
  }
  await sleep(300); // a moment for the first ticks
  return evaluate(`({
    screen: document.body.dataset.screen || '',
    title: document.title,
    figures: document.getElementById('r-figures').textContent,
    dots: [...document.querySelectorAll('[data-face]')].filter(d => !d.hidden).map(d => d.dataset.face),
  })`);
}

const running = (over = {}) => {
  const now = Date.now();
  return { id: 'smoke', title: 'Notes', next: 'Lunch', step: '', kind: 'main', totalMs: 25 * MIN, warnMs: 4 * MIN, autoWarn: false, endAt: now + 20 * MIN, pausedAt: null, finishedAt: null, fired: {}, ...over };
};
const finished = () => { const now = Date.now(); return running({ endAt: now - MIN, finishedAt: now - MIN, fired: { half: true, warn: true, finish: true } }); };

const CASES = [
  { name: 'first visit', data: {}, want: s => s.screen === 'setup' && s.title === 'TimeFall' },
  { name: 'Full mode, running', data: { settings: { defaultMode: 'full' }, session: running() }, want: s => s.screen === 'run' && / min · Notes$/.test(s.title) && /left/.test(s.figures) },
  { name: 'Full mode, paused', data: { settings: { defaultMode: 'full' }, session: running({ pausedAt: Date.now() - MIN }) }, want: s => s.screen === 'run' && s.title.startsWith('Paused') },
  { name: 'Work mode, running', data: { settings: { defaultMode: 'work', face: 'disc' }, session: running() }, want: s => s.screen === 'run' && s.title === 'Day' && s.figures === '' && !s.dots.includes('disc') && !s.dots.includes('ruler') },
  { name: 'Work mode, finished', data: { settings: { defaultMode: 'work' }, session: finished() }, want: s => s.screen === 'landing' && s.title === 'Day' },
  { name: 'Simple mode, running', data: { settings: { defaultMode: 'simple' }, session: running() }, want: s => s.screen === 'run' },
  { name: 'Work mode, setup with presets', data: { settings: { defaultMode: 'work' }, presets: [{ title: '', minutes: 25, warn: 'auto' }] }, want: s => s.screen === 'setup' && s.title === 'Day' },
];

let failed = 0;
try {
  for (const c of CASES) {
    const seen = await open(c.data);
    const ok = c.want(seen) && problems.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? 'ok    ' : 'FAILED'}  ${c.name}  ${JSON.stringify(seen)}`);
    for (const p of problems) console.log(`        ${p}`);
  }
} finally {
  ws.close();
  chrome.kill();
  server.close();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
if (failed) { console.log(`\n${failed} of ${CASES.length} page checks failed.`); process.exit(1); }
console.log(`\nAll ${CASES.length} page checks passed.`);
